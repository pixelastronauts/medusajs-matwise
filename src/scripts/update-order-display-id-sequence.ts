import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function updateOrderDisplayIdSequence({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const START_FROM = 2000

  logger.info(`Updating order display_id sequence to start from ${START_FROM}...`)

  try {
    // Get current max display_id from orders
    const result = await pgConnection.raw(`
      SELECT COALESCE(MAX(display_id), 0) as max_id FROM "order"
    `)

    const currentMaxId = parseInt(result.rows?.[0]?.max_id || '0', 10)
    logger.info(`Current max order display_id: ${currentMaxId}`)

    if (currentMaxId >= START_FROM) {
      logger.warn(`Current max display_id (${currentMaxId}) is already >= ${START_FROM}. No change needed.`)
      return
    }

    // Update the sequence to start from START_FROM
    // The sequence name in Medusa v2 is typically "order_display_id_seq"
    await pgConnection.raw(`
      ALTER SEQUENCE "order_display_id_seq" RESTART WITH ${START_FROM}
    `)

    logger.info(`✅ Order display_id sequence updated. Next order will have display_id = ${START_FROM}`)
  } catch (error) {
    logger.error(`Failed to update order display_id sequence: ${error}`)
    throw error
  }
}
