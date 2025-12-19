import React, { useState, useEffect } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Button, Badge, Text, Heading, Tooltip } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { ArrowPath, CheckCircle, XCircle, ExclamationCircle, ArrowUpRightOnBox } from "@medusajs/icons"

type SanityDocument = {
  _id: string
  _type: string
  title: string
  handle: string
  lastSyncedAt: string
  variants?: any[]
}

const ProductSanityStatusWidget = () => {
  const { id: productId } = useParams()

  const [sanityDoc, setSanityDoc] = useState<SanityDocument | null>(null)
  const [studioUrl, setStudioUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSanityStatus()
  }, [productId])

  const fetchSanityStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/admin/sanity/documents/${productId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        setSanityDoc(data.sanity_document)
        setStudioUrl(data.studio_url)
      } else {
        setError("Failed to fetch Sanity status")
      }
    } catch (err) {
      setError("Failed to connect to Sanity")
    } finally {
      setLoading(false)
    }
  }

  const syncToSanity = async () => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch(`/admin/sanity/documents/${productId}/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        // Wait a moment for sync to complete, then refresh
        setTimeout(() => fetchSanityStatus(), 1000)
      } else {
        setError("Failed to sync to Sanity")
      }
    } catch (err) {
      setError("Failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  const getStatusInfo = () => {
    if (!sanityDoc) {
      return {
        status: "missing",
        color: "red" as const,
        icon: <XCircle className="w-4 h-4" />,
        label: "Not in Sanity",
        description: "This product hasn't been synced to Sanity CMS yet.",
      }
    }

    const lastSynced = sanityDoc.lastSyncedAt
      ? new Date(sanityDoc.lastSyncedAt)
      : null

    if (!lastSynced) {
      return {
        status: "unknown",
        color: "orange" as const,
        icon: <ExclamationCircle className="w-4 h-4" />,
        label: "Sync Unknown",
        description: "Document exists but sync time is unknown.",
      }
    }

    // Consider "recent" if synced within last hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (lastSynced > hourAgo) {
      return {
        status: "synced",
        color: "green" as const,
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Synced",
        description: `Last synced ${lastSynced.toLocaleString()}`,
      }
    }

    return {
      status: "stale",
      color: "orange" as const,
      icon: <ExclamationCircle className="w-4 h-4" />,
      label: "May Need Sync",
      description: `Last synced ${lastSynced.toLocaleString()}`,
    }
  }

  if (loading) {
    return (
      <Container className="p-4">
        <div className="flex items-center gap-2">
          <ArrowPath className="w-4 h-4 animate-spin" />
          <Text className="text-sm text-gray-500">Loading Sanity status...</Text>
        </div>
      </Container>
    )
  }

  const statusInfo = getStatusInfo()

  return (
    <Container className="p-4">
      <div className="flex items-center justify-between mb-3">
        <Heading level="h2" className="text-base">Sanity CMS</Heading>
        <Badge color={statusInfo.color} size="small">
          {statusInfo.icon}
          <span className="ml-1">{statusInfo.label}</span>
        </Badge>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <Text className="text-sm text-gray-500 mb-3">{statusInfo.description}</Text>

      {sanityDoc && (
        <div className="bg-gray-50 rounded p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <Text className="text-gray-500">Variants synced:</Text>
            <Text className="font-medium">{sanityDoc.variants?.length || 0}</Text>
          </div>
          {sanityDoc.lastSyncedAt && (
            <div className="flex justify-between">
              <Text className="text-gray-500">Last sync:</Text>
              <Text className="font-medium">
                {new Date(sanityDoc.lastSyncedAt).toLocaleDateString()}
              </Text>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="small"
          onClick={syncToSanity}
          disabled={syncing}
          className="flex-1"
        >
          {syncing ? (
            <>
              <ArrowPath className="w-3 h-3 mr-1 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <ArrowPath className="w-3 h-3 mr-1" />
              Sync Now
            </>
          )}
        </Button>

        {studioUrl && (
          <Tooltip content="Open in Sanity Studio">
            <Button
              variant="secondary"
              size="small"
              onClick={() => window.open(studioUrl, "_blank")}
            >
              <ArrowUpRightOnBox className="w-3 h-3" />
            </Button>
          </Tooltip>
        )}
      </div>

      <div className="mt-3 pt-3 border-t">
        <a
          href="/settings/sanity-sync"
          className="text-xs text-blue-600 hover:underline"
        >
          View full sync status →
        </a>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductSanityStatusWidget





