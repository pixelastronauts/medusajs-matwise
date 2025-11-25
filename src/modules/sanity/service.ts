import { Logger } from "@medusajs/framework/types"
import { createClient, SanityClient, FirstDocumentMutationOptions } from "@sanity/client"
import type { ProductDTO, ProductVariantDTO } from "@medusajs/framework/types"

const SyncDocumentTypes = {
  PRODUCT: "product",
  PRODUCT_VARIANT: "productVariant",
  COLLECTION: "collection",
} as const

type SyncDocumentTypes = (typeof SyncDocumentTypes)[keyof typeof SyncDocumentTypes]

type SyncDocumentInputs<T> = T extends "product"
  ? ProductDTO & { variants?: any[] }
  : T extends "productVariant"
  ? ProductVariantDTO & { product_id: string }
  : T extends "collection"
  ? any
  : never

type ModuleOptions = {
  api_token: string
  project_id: string
  api_version: string
  dataset: "production" | "development"
  type_map?: Record<SyncDocumentTypes, string>
  studio_url?: string
}

type InjectedDependencies = {
  logger: Logger
}

type TransformationMap<T> = Record<SyncDocumentTypes, (data: SyncDocumentInputs<T>) => any>

class SanityModuleService {
  private client: SanityClient
  private studioUrl?: string
  private logger: Logger
  private typeMap: Record<SyncDocumentTypes, string>
  private createTransformationMap: TransformationMap<SyncDocumentTypes>
  private updateTransformationMap: TransformationMap<SyncDocumentTypes>

  constructor({ logger }: InjectedDependencies, options: ModuleOptions) {
    this.client = createClient({
      projectId: options.project_id,
      apiVersion: options.api_version,
      dataset: options.dataset,
      token: options.api_token,
      useCdn: false,
    })

    this.logger = logger
    this.logger.info("Connected to Sanity")
    this.studioUrl = options.studio_url

    this.typeMap = Object.assign(
      {},
      {
        [SyncDocumentTypes.PRODUCT]: "product",
        [SyncDocumentTypes.PRODUCT_VARIANT]: "productVariant",
        [SyncDocumentTypes.COLLECTION]: "collection",
      },
      options.type_map || {}
    )

    this.createTransformationMap = {
      [SyncDocumentTypes.PRODUCT]: this.transformProductForCreate,
      [SyncDocumentTypes.PRODUCT_VARIANT]: this.transformProductVariantForCreate,
      [SyncDocumentTypes.COLLECTION]: this.transformCollectionForCreate,
    }

    this.updateTransformationMap = {
      [SyncDocumentTypes.PRODUCT]: this.transformProductForUpdate,
      [SyncDocumentTypes.PRODUCT_VARIANT]: this.transformProductVariantForUpdate,
      [SyncDocumentTypes.COLLECTION]: this.transformCollectionForUpdate,
    }
  }

  private transformProductForCreate = (product: ProductDTO & { variants?: any[] }) => {
    const doc: any = {
      _type: this.typeMap[SyncDocumentTypes.PRODUCT],
      _id: product.id,
      title: product.title,
      handle: product.handle,
      lastSyncedAt: new Date().toISOString(),
    }

    if (product.variants) {
      doc.variants = product.variants
    }

    return doc
  }

  private transformProductForUpdate = (product: ProductDTO & { variants?: any[] }) => {
    const set: any = {
      title: product.title,
      handle: product.handle,
      lastSyncedAt: new Date().toISOString(),
    }

    if (product.variants) {
      set.variants = product.variants
    }

    return {
      set,
    }
  }

  private transformProductVariantForCreate = (variant: ProductVariantDTO & { product_id: string }) => {
    return {
      _type: this.typeMap[SyncDocumentTypes.PRODUCT_VARIANT],
      _id: variant.id,
      title: variant.title,
      sku: variant.sku,
      product: {
        _type: 'reference',
        _ref: variant.product_id,
      },
      lastSyncedAt: new Date().toISOString(),
    }
  }

  private transformProductVariantForUpdate = (variant: ProductVariantDTO & { product_id: string }) => {
    return {
      set: {
        title: variant.title,
        sku: variant.sku,
        product: {
          _type: 'reference',
          _ref: variant.product_id,
        },
        lastSyncedAt: new Date().toISOString(),
      },
    }
  }

  private transformCollectionForCreate = (collection: any) => {
    return {
      _type: this.typeMap[SyncDocumentTypes.COLLECTION],
      _id: collection.id,
      title: collection.title,
      handle: collection.handle,
      lastSyncedAt: new Date().toISOString(),
    }
  }

  private transformCollectionForUpdate = (collection: any) => {
    return {
      set: {
        title: collection.title,
        handle: collection.handle,
        lastSyncedAt: new Date().toISOString(),
      },
    }
  }

  async upsertSyncDocument<T extends SyncDocumentTypes>(
    type: T,
    data: SyncDocumentInputs<T>
  ) {
    const existing = await this.client.getDocument(data.id)
    if (existing) {
      return await this.updateSyncDocument(type, data)
    }
    return await this.createSyncDocument(type, data)
  }

  async createSyncDocument<T extends SyncDocumentTypes>(
    type: T,
    data: SyncDocumentInputs<T>,
    options?: FirstDocumentMutationOptions
  ) {
    const doc = this.createTransformationMap[type](data)
    return await this.client.create(doc, options)
  }

  async updateSyncDocument<T extends SyncDocumentTypes>(type: T, data: SyncDocumentInputs<T>) {
    const operations = this.updateTransformationMap[type](data)
    return await this.client.patch(data.id, operations).commit()
  }

  async retrieve(id: string) {
    return this.client.getDocument(id)
  }

  async delete(id: string) {
    return this.client.delete(id)
  }

  async update(id: string, data: any) {
    return await this.client.patch(id, { set: data }).commit()
  }

  async list(filter: { id: string | string[] }) {
    const data = await this.client.getDocuments(
      Array.isArray(filter.id) ? filter.id : [filter.id]
    )
    return data.map((doc) => ({
      id: doc?._id,
      ...doc,
    }))
  }

  async getStudioLink(type: string, id: string, config: { explicit_type?: boolean } = {}) {
    const resolvedType = config.explicit_type ? type : this.typeMap[type]
    if (!this.studioUrl) {
      throw new Error("No studio URL provided")
    }
    return `${this.studioUrl}/structure/${resolvedType};${id}`
  }
}

export default SanityModuleService

