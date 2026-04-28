'use strict';

const API_URL = 'https://api.monday.com/v2';
const API_VERSION = '2025-04';

class MondayClient {
  constructor({ token, fetchImpl = globalThis.fetch } = {}) {
    if (!token) throw new Error('MondayClient requires an API token');
    if (!fetchImpl) throw new Error('global fetch is unavailable; pass fetchImpl');
    this.token = token;
    this.fetch = fetchImpl;
  }

  async query(query, variables = {}) {
    const res = await this.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token,
        'API-Version': API_VERSION
      },
      body: JSON.stringify({ query, variables })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`monday API HTTP ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length) {
      throw new Error(`monday API error: ${JSON.stringify(json.errors)}`);
    }
    if (json.error_message) {
      throw new Error(`monday API error: ${json.error_message}`);
    }
    return json.data;
  }

  async listBoardItems(boardId) {
    const items = [];
    let cursor = null;
    const query = `
      query ($boardId: [ID!], $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: 500, cursor: $cursor) {
            cursor
            items {
              id
              name
              column_values {
                id
                type
                text
                value
                ... on BoardRelationValue {
                  linked_item_ids
                  linked_items { id name }
                }
              }
            }
          }
        }
      }
    `;
    do {
      const data = await this.query(query, { boardId: [String(boardId)], cursor });
      const board = data.boards && data.boards[0];
      if (!board) break;
      const page = board.items_page;
      items.push(...page.items);
      cursor = page.cursor;
    } while (cursor);
    return items;
  }

  async listBoardColumns(boardId) {
    const data = await this.query(
      `query ($id: [ID!]) { boards(ids: $id) { id columns { id title type settings_str } } }`,
      { id: [String(boardId)] }
    );
    const board = data.boards && data.boards[0];
    return board ? board.columns : [];
  }

  async getItem(itemId) {
    const data = await this.query(
      `query ($id: [ID!]) {
        items(ids: $id) {
          id
          name
          board { id }
          column_values {
            id
            type
            text
            value
            ... on BoardRelationValue {
              linked_item_ids
              linked_items { id name }
            }
          }
        }
      }`,
      { id: [String(itemId)] }
    );
    return data.items && data.items[0];
  }

  async createItem({ boardId, itemName, columnValues, createLabelsIfMissing = false }) {
    const query = `
      mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON!, $createLabels: Boolean) {
        create_item(
          board_id: $boardId,
          item_name: $itemName,
          column_values: $columnValues,
          create_labels_if_missing: $createLabels
        ) { id }
      }
    `;
    const data = await this.query(query, {
      boardId: String(boardId),
      itemName,
      columnValues: JSON.stringify(columnValues),
      createLabels: createLabelsIfMissing
    });
    return data.create_item;
  }

  async createColumn({ boardId, title, columnType, defaults }) {
    const query = `
      mutation CreateColumn($boardId: ID!, $title: String!, $columnType: ColumnType!, $defaults: JSON) {
        create_column(
          board_id: $boardId,
          title: $title,
          column_type: $columnType,
          defaults: $defaults
        ) { id title type }
      }
    `;
    const data = await this.query(query, {
      boardId: String(boardId),
      title,
      columnType,
      defaults: defaults ? JSON.stringify(defaults) : null
    });
    return data.create_column;
  }

  async updateColumnValues(boardId, itemId, columnValues, { createLabelsIfMissing = false } = {}) {
    const mutation = `
      mutation ($boardId: ID!, $itemId: ID!, $values: JSON!, $createLabels: Boolean) {
        change_multiple_column_values(
          board_id: $boardId,
          item_id: $itemId,
          column_values: $values,
          create_labels_if_missing: $createLabels
        ) { id }
      }
    `;
    return this.query(mutation, {
      boardId: String(boardId),
      itemId: String(itemId),
      values: JSON.stringify(columnValues),
      createLabels: createLabelsIfMissing
    });
  }

  async createUpdate(itemId, body) {
    const mutation = `
      mutation ($itemId: ID!, $body: String!) {
        create_update(item_id: $itemId, body: $body) { id }
      }
    `;
    return this.query(mutation, { itemId: String(itemId), body });
  }

  async getMe() {
    const data = await this.query(`query { me { id name email } }`);
    return data.me;
  }
}

module.exports = { MondayClient, API_URL, API_VERSION };
