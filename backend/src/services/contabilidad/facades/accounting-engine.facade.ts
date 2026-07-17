import { ExcelLibroDiarioService } from "./excel-libro-diario.facade";

export class AccountingEngine {
  constructor(private readonly excelLibroDiarioService = new ExcelLibroDiarioService()) {}

  async process(buffer: Buffer, originalFilename: string): Promise<Record<string, unknown>> {
    return this.excelLibroDiarioService.processAsync(buffer, originalFilename);
  }
}
