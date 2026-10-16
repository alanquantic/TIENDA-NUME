import type { MondayPayload, MondayKind } from './shared';

const API_URL = 'https://api.monday.com/v2';
const API_VERSION = '2026-07';

export class MondayError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export type MondayClient = ReturnType<typeof createMondayClient>;

export function createMondayClient(token: string, fetcher: typeof fetch = fetch) {
  async function request<T>(query: string, variables: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const response = await fetcher(API_URL, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'API-Version': API_VERSION,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new MondayError(`monday-http-${response.status}`);
    const result = await response.json() as { data?: T; errors?: Array<{ extensions?: { code?: string } }> };
    if (result.errors?.length) {
      // Keep order data and credentials out of persisted error messages/logs.
      const code = result.errors[0].extensions?.code?.replace(/[^\w-]/g, '').slice(0, 80) || 'graphql-error';
      throw new MondayError(`monday-${code}`);
    }
    if (!result.data) throw new MondayError('monday-empty-response');
    return result.data;
  }

  async function inspectOrder(boardId: string, orderNumber: string, orderColumn = 'texto'): Promise<{
    itemId: string | null; postalColumnType: string | undefined;
  }> {
    const data = await request<{
      boards: Array<{ id: string; columns: Array<{ id: string; type: string }> }>;
      items_page_by_column_values: { items: Array<{ id: string; column_values: Array<{ id: string; text: string }> }> };
    }>(`query PurchaseOrder($boardId: ID!, $orderNumber: String!, $orderColumn: String!) {
      boards(ids: [$boardId]) { id columns { id type } }
      items_page_by_column_values(board_id: $boardId, limit: 100,
        columns: [{ column_id: $orderColumn, column_values: [$orderNumber] }]) {
        items { id column_values(ids: [$orderColumn]) { id text } }
      }
    }`, { boardId, orderNumber, orderColumn });
    const board = data.boards[0];
    if (!board) throw new MondayError('monday-board-not-accessible');
    const matches = data.items_page_by_column_values.items.filter((item) =>
      item.column_values.some((column) => column.id === orderColumn && column.text === orderNumber));
    if (matches.length > 1) throw new MondayError('monday-duplicate-order-needs-review');
    return {
      itemId: matches[0]?.id ?? null,
      postalColumnType: board.columns.find((column) => column.id === 'dup__of_municipio_delegaci_n')?.type,
    };
  }

  async function createPurchaseItem(input: {
    boardId: string; groupId: string; orderId: string; payload: MondayPayload; kind?: MondayKind;
  }) {
    const result = await request<{ create_item: { id: string } | null }>(
      `mutation ProductPurchase($boardId: ID!, $groupId: String!, $name: String!, $columns: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $name,
          column_values: $columns, create_labels_if_missing: false) { id }
      }`,
      { boardId: input.boardId, groupId: input.groupId, name: input.payload.name,
        columns: JSON.stringify(input.payload.columns) },
      `tienda-nume:${input.kind ?? 'agenda-2027'}:${input.boardId}:${input.orderId}`,
    );
    if (!result.create_item?.id) throw new MondayError('monday-missing-item-id');
    return result.create_item.id;
  }

  return { inspectOrder, createPurchaseItem };
}
