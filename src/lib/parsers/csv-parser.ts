import Papa from 'papaparse'

export type ParsedRow = Record<string, string>

export function parseCSV(csvText: string): ParsedRow[] {
  const result = Papa.parse<ParsedRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  return result.data
}
