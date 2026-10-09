import { Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { TransactionImportFormat } from 'pulpe-shared';
import {
  type BankStatement,
  type ImportedKind,
  MalformedStatementError,
  type StatementOperation,
} from '../../domain/bank-statement.entity';
import type { StatementParser } from '../../domain/ports/statement-parser.port';

type XmlNode = Record<string, unknown>;

const CAMT053_NAMESPACE = 'urn:iso:std:iso:20022:tech:xsd:camt.053.';
const REPEATED_ELEMENTS = new Set([
  'Stmt',
  'Ntry',
  'NtryDtls',
  'TxDtls',
  'Ustrd',
]);
const DIRECTIONS: Readonly<Record<string, ImportedKind>> = {
  CRDT: 'income',
  DBIT: 'expense',
};

/**
 * ISO 20022 camt.053 (Bank to Customer Statement), the end-of-day statement
 * every Swiss bank offers since the 2018 harmonisation. One `Ntry` is one
 * booked movement of the account; batch details (`TxDtls`) only enrich its
 * label, the entry amount is the one that hit the account.
 *
 * Schema versions 001.02 to 001.08+ differ only in where the status code and
 * the party names sit; both shapes are read.
 */
@Injectable()
export class Camt053Parser implements StatementParser {
  readonly format: TransactionImportFormat = 'camt053';

  readonly #parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    // Amounts and references must stay strings: "0012.50" or an all-digit
    // reference would otherwise be silently turned into numbers.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (tagName) => REPEATED_ELEMENTS.has(tagName),
  });

  accepts(content: string): boolean {
    return content.includes(CAMT053_NAMESPACE);
  }

  parse(content: string): BankStatement {
    // A statement never needs a DTD; refusing one rules out entity expansion.
    if (/<!DOCTYPE|<!ENTITY/i.test(content)) {
      throw new MalformedStatementError('DTD declarations are not allowed');
    }
    const validation = XMLValidator.validate(content);
    if (validation !== true) {
      throw new MalformedStatementError(
        `invalid XML at line ${validation.err.line}`,
      );
    }

    const root = asNode(this.#parser.parse(content));
    const statements = asNodes(
      child(root, 'Document', 'BkToCstmrStmt', 'Stmt'),
    );
    if (statements.length === 0) {
      throw new MalformedStatementError('no Stmt element');
    }

    let position = 0;
    const operations: StatementOperation[] = [];
    for (const statement of statements) {
      const accountCurrency = text(child(statement, 'Acct', 'Ccy'));
      for (const entry of asNodes(child(statement, 'Ntry'))) {
        position += 1;
        operations.push(readEntry(entry, position, accountCurrency));
      }
    }

    return {
      format: this.format,
      accountId: readAccountId(statements[0]),
      operations,
    };
  }
}

function readAccountId(statement: XmlNode): string | null {
  return (
    text(child(statement, 'Acct', 'Id', 'IBAN')) ??
    text(child(statement, 'Acct', 'Id', 'Othr', 'Id'))
  );
}

function readEntry(
  entry: XmlNode,
  position: number,
  accountCurrency: string | null,
): StatementOperation {
  const amountNode = child(entry, 'Amt');
  const direction = text(child(entry, 'CdtDbtInd'));
  const kind = direction ? (DIRECTIONS[direction] ?? null) : null;
  const details = asNodes(child(entry, 'NtryDtls')).flatMap((group) =>
    asNodes(child(group, 'TxDtls')),
  );
  const singleDetail = details.length === 1 ? details[0] : null;

  return {
    position,
    date: readDate(child(entry, 'BookgDt')) ?? readDate(child(entry, 'ValDt')),
    amount: readAmount(text(amountNode)),
    currency: attribute(amountNode, 'Ccy') ?? accountCurrency,
    direction: kind,
    label: readLabel(entry, singleDetail, kind),
    isBooked: readStatus(entry) === 'BOOK',
    bankReference:
      text(child(entry, 'AcctSvcrRef')) ??
      text(child(entry, 'NtryRef')) ??
      text(child(singleDetail, 'Refs', 'AcctSvcrRef')),
  };
}

/** Up to 001.07 `<Sts>BOOK</Sts>`; from 001.08 `<Sts><Cd>BOOK</Cd></Sts>`. */
function readStatus(entry: XmlNode): string | null {
  const status = child(entry, 'Sts');
  return text(child(status, 'Cd')) ?? text(status);
}

function readDate(dateNode: unknown): string | null {
  const value = text(child(dateNode, 'Dt')) ?? text(child(dateNode, 'DtTm'));
  return value ? value.slice(0, 10) : null;
}

function readAmount(value: string | null): number | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}

/**
 * Most telling first: the other party (who was paid, or who paid), then the
 * free remittance text, then the bank's own description of the entry. Batch
 * entries have no single counterparty, so they go straight to the entry text.
 */
function readLabel(
  entry: XmlNode,
  detail: XmlNode | null,
  kind: ImportedKind | null,
): string | null {
  const counterpartyRole = kind === 'income' ? 'Dbtr' : 'Cdtr';
  const parties = child(detail, 'RltdPties');
  return (
    text(child(parties, counterpartyRole, 'Nm')) ??
    text(child(parties, counterpartyRole, 'Pty', 'Nm')) ??
    joinTexts(child(detail, 'RmtInf', 'Ustrd')) ??
    text(child(detail, 'AddtlTxInf')) ??
    text(child(entry, 'AddtlNtryInf'))
  );
}

function joinTexts(value: unknown): string | null {
  const parts = (Array.isArray(value) ? value : [value])
    .map(text)
    .filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Walks `path`, taking the first element of any repeated intermediate. The
 * last step is returned as-is, so a repeated target (`Stmt`, `Ntry`, `Ustrd`)
 * comes back whole.
 */
function child(node: unknown, ...path: string[]): unknown {
  let current = node;
  for (const key of path) {
    const parent = Array.isArray(current) ? current[0] : current;
    if (!isNode(parent)) return undefined;
    current = parent[key];
  }
  return current;
}

function attribute(node: unknown, name: string): string | null {
  const single = Array.isArray(node) ? node[0] : node;
  return isNode(single) ? text(single[`@_${name}`]) : null;
}

/** Element text, whether the parser gave a bare string or `{ '#text': … }`. */
function text(value: unknown): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  const raw = isNode(single) ? single['#text'] : single;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

function asNodes(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

function asNode(value: unknown): XmlNode {
  if (!isNode(value)) throw new MalformedStatementError('empty document');
  return value;
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
