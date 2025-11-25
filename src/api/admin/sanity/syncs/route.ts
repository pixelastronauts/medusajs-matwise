import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sanitySyncProductsWorkflow } from "../../../../workflows/sanity-sync-products"
import { sanitySyncCollectionsWorkflow } from "../../../../workflows/sanity-sync-collections"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE)

  const [productExecutions, productCount] = await workflowEngine.listAndCountWorkflowExecutions(
    {
      workflow_id: sanitySyncProductsWorkflow.getName(),
    },
    { order: { created_at: "DESC" } }
  )

  const [collectionExecutions, collectionCount] =
    await workflowEngine.listAndCountWorkflowExecutions(
      {
        workflow_id: sanitySyncCollectionsWorkflow.getName(),
      },
      { order: { created_at: "DESC" } }
    )

  res.json({
    workflow_executions: [...productExecutions, ...collectionExecutions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    count: productCount + collectionCount,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { type } = req.body as { type?: "products" | "collections" | "all" }

  const results: any[] = []

  if (!type || type === "products" || type === "all") {
    const { transaction } = await sanitySyncProductsWorkflow(req.scope).run({
      input: {},
    })
    results.push({ type: "products", transaction_id: transaction.transactionId })
  }

  if (!type || type === "collections" || type === "all") {
    const { transaction } = await sanitySyncCollectionsWorkflow(req.scope).run({
      input: {},
    })
    results.push({ type: "collections", transaction_id: transaction.transactionId })
  }

  res.json({ syncs: results })
}

