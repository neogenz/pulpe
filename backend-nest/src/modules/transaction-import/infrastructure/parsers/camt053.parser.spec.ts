import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MalformedStatementError } from '../../domain/bank-statement.entity';
import { Camt053Parser } from './camt053.parser';

const sample = readFileSync(
  join(import.meta.dir, '__fixtures__', 'camt053-001-04.xml'),
  'utf8',
);

const v08Entry = (inner: string) => `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><Stmt>
    <Acct><Id><Othr><Id>ACC-42</Id></Othr></Id></Acct>
    <Ntry>${inner}</Ntry>
  </Stmt></BkToCstmrStmt>
</Document>`;

describe('Camt053Parser', () => {
  const parser = new Camt053Parser();

  it('accepts camt.053 files only', () => {
    expect(parser.accepts(sample)).toBe(true);
    expect(
      parser.accepts(
        '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.04"/>',
      ),
    ).toBe(false);
    expect(parser.accepts('OFXHEADER:100')).toBe(false);
  });

  it('reads every entry of a Swiss 001.04 statement in file order', () => {
    const statement = parser.parse(sample);

    expect(statement.format).toBe('camt053');
    expect(statement.accountId).toBe('CH9300762011623852957');
    expect(statement.operations).toEqual([
      {
        position: 1,
        date: '2026-03-25',
        amount: 5200,
        currency: 'CHF',
        direction: 'income',
        label: 'Exemple SA',
        isBooked: true,
        bankReference: '20260325000123456',
      },
      {
        position: 2,
        date: '2026-03-04',
        amount: 84.35,
        currency: 'CHF',
        direction: 'expense',
        label: 'Supermarché   du Centre',
        isBooked: true,
        bankReference: '20260304000987654',
      },
      {
        position: 3,
        date: '2026-03-10',
        amount: 4.8,
        currency: 'CHF',
        direction: 'expense',
        label: 'TWINT Café de la Gare',
        isBooked: true,
        bankReference: null,
      },
      {
        position: 4,
        date: '2026-03-10',
        amount: 4.8,
        currency: 'CHF',
        direction: 'expense',
        label: 'TWINT Café de la Gare',
        isBooked: true,
        bankReference: null,
      },
      {
        position: 5,
        date: '2026-03-15',
        amount: 150,
        currency: 'CHF',
        direction: 'expense',
        label: 'ORDRE GROUPE 2 PAIEMENTS',
        isBooked: true,
        bankReference: '20260315000555000',
      },
      {
        position: 6,
        date: '2026-03-31',
        amount: 32,
        currency: 'CHF',
        direction: 'expense',
        label: 'RESERVATION CARTE STATION SERVICE',
        isBooked: false,
        bankReference: null,
      },
    ]);
  });

  it('reads the 001.08 status code and party shapes', () => {
    const statement = parser.parse(
      v08Entry(`
        <Amt Ccy="EUR">12.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><DtTm>2026-03-02T08:15:00+01:00</DtTm></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties><Cdtr><Pty><Nm>Boulangerie</Nm></Pty></Cdtr></RltdPties>
        </TxDtls></NtryDtls>`),
    );

    expect(statement.accountId).toBe('ACC-42');
    expect(statement.operations[0]).toMatchObject({
      date: '2026-03-02',
      currency: 'EUR',
      label: 'Boulangerie',
      isBooked: true,
    });
  });

  it('falls back to remittance text when no counterparty is named', () => {
    const statement = parser.parse(
      v08Entry(`
        <Amt Ccy="CHF">20.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-03-02</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RmtInf><Ustrd>Remboursement</Ustrd><Ustrd>repas</Ustrd></RmtInf>
        </TxDtls></NtryDtls>`),
    );

    expect(statement.operations[0].label).toBe('Remboursement repas');
  });

  it('reports unreadable fields as null instead of guessing', () => {
    const statement = parser.parse(
      v08Entry(`
        <Amt Ccy="CHF">12,50</Amt>
        <CdtDbtInd>XXXX</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>`),
    );

    expect(statement.operations[0]).toMatchObject({
      date: null,
      amount: null,
      direction: null,
      label: null,
    });
  });

  it('keeps all-digit references as strings', () => {
    const statement = parser.parse(
      v08Entry(`
        <Amt Ccy="CHF">1.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <NtryRef>000123</NtryRef>`),
    );

    expect(statement.operations[0].bankReference).toBe('000123');
  });

  it('refuses broken XML, DTDs and documents without statement', () => {
    expect(() => parser.parse(sample.slice(0, 400))).toThrow(
      MalformedStatementError,
    );
    expect(() =>
      parser.parse(
        `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY a "x">]>${sample}`,
      ),
    ).toThrow(MalformedStatementError);
    expect(() =>
      parser.parse(
        '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04"><BkToCstmrStmt/></Document>',
      ),
    ).toThrow(MalformedStatementError);
  });
});
