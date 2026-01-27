import { Injectable } from '@angular/core';
import { FinanceService } from './finance.service';
import { Transaction } from '../models/transaction.model';
import { PeriodSummary } from './finance.service';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  constructor(private financeService: FinanceService) {}

  async exportToPDF(summary: PeriodSummary, transactions: Transaction[], period: string): Promise<void> {
    // Implementação básica - em produção, usar jsPDF
    const content = this.generatePDFContent(summary, transactions, period);
    this.downloadFile(content, 'relatorio.pdf', 'application/pdf');
  }

  async exportToExcel(summary: PeriodSummary, transactions: Transaction[], period: string): Promise<void> {
    // Implementação básica - em produção, usar xlsx
    const content = this.generateExcelContent(summary, transactions, period);
    this.downloadFile(content, 'relatorio.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  private generatePDFContent(summary: PeriodSummary, transactions: Transaction[], period: string): string {
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');
    
    let content = `═══════════════════════════════════════════════════\n`;
    content += `     RELATÓRIO FINANCEIRO - SOLARIS\n`;
    content += `═══════════════════════════════════════════════════\n\n`;
    content += `Data de Geração: ${date} às ${time}\n`;
    content += `Período: ${this.getPeriodLabel(period)}\n`;
    content += `Data de Referência: ${this.financeService.formatDate(summary.date)}\n\n`;
    
    content += `═══════════════════════════════════════════════════\n`;
    content += `                    RESUMO\n`;
    content += `═══════════════════════════════════════════════════\n`;
    content += `Total de Entradas: ${this.financeService.formatCurrency(summary.totalEntradas)}\n`;
    content += `Total de Saídas:   ${this.financeService.formatCurrency(summary.totalSaidas)}\n`;
    content += `Saldo Final:        ${this.financeService.formatCurrency(summary.saldo)}\n\n`;
    
    content += `═══════════════════════════════════════════════════\n`;
    content += `                 TRANSAÇÕES\n`;
    content += `═══════════════════════════════════════════════════\n\n`;
    
    if (transactions.length === 0) {
      content += `Nenhuma transação encontrada no período.\n`;
    } else {
      // Agrupar por tipo
      const entradas = transactions.filter(t => t.type === 'entrada');
      const saidas = transactions.filter(t => t.type === 'saida');
      
      if (entradas.length > 0) {
        content += `ENTRADAS (${entradas.length}):\n`;
        content += `───────────────────────────────────────────────────\n`;
        entradas.forEach((t, index) => {
          content += `${index + 1}. ${t.title}\n`;
          content += `   Valor: ${this.financeService.formatCurrency(t.amount)}\n`;
          content += `   Categoria: ${t.category}\n`;
          content += `   Forma de Pagamento: ${this.getPaymentMethodLabel(t.paymentMethod)}\n`;
          content += `   Data: ${this.financeService.formatDate(t.date)}\n`;
          if (t.description) {
            content += `   Observação: ${t.description}\n`;
          }
          content += `\n`;
        });
      }
      
      if (saidas.length > 0) {
        content += `SAÍDAS (${saidas.length}):\n`;
        content += `───────────────────────────────────────────────────\n`;
        saidas.forEach((t, index) => {
          content += `${index + 1}. ${t.title}\n`;
          content += `   Valor: ${this.financeService.formatCurrency(t.amount)}\n`;
          content += `   Categoria: ${t.category}\n`;
          content += `   Forma de Pagamento: ${this.getPaymentMethodLabel(t.paymentMethod)}\n`;
          content += `   Data: ${this.financeService.formatDate(t.date)}\n`;
          if (t.description) {
            content += `   Observação: ${t.description}\n`;
          }
          content += `\n`;
        });
      }
    }
    
    content += `═══════════════════════════════════════════════════\n`;
    content += `Total de Transações: ${transactions.length}\n`;
    content += `═══════════════════════════════════════════════════\n`;
    
    return content;
  }

  private getPeriodLabel(period: string): string {
    const labels: { [key: string]: string } = {
      'dia': 'Diário',
      'semana': 'Semanal',
      'mes': 'Mensal'
    };
    return labels[period] || period;
  }

  private getPaymentMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'pix': 'PIX',
      'dinheiro': 'Dinheiro',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito'
    };
    return labels[method] || method;
  }

  private generateExcelContent(summary: PeriodSummary, transactions: Transaction[], period: string): string {
    const date = new Date().toLocaleDateString('pt-BR');
    
    let content = 'RELATÓRIO FINANCEIRO - SOLARIS\n';
    content += `Data de Geração,${date}\n`;
    content += `Período,${this.getPeriodLabel(period)}\n`;
    content += `Data de Referência,${this.financeService.formatDate(summary.date)}\n`;
    content += '\n';
    content += 'RESUMO\n';
    content += `Total de Entradas,${summary.totalEntradas}\n`;
    content += `Total de Saídas,${summary.totalSaidas}\n`;
    content += `Saldo Final,${summary.saldo}\n`;
    content += '\n';
    content += 'TRANSAÇÕES\n';
    content += 'Tipo,Título,Valor,Categoria,Forma de Pagamento,Data,Descrição\n';
    
    transactions.forEach(t => {
      const description = (t.description || '').replace(/,/g, ';').replace(/\n/g, ' ');
      content += `${t.type === 'entrada' ? 'Entrada' : 'Saída'},${t.title},${t.amount},${t.category},${this.getPaymentMethodLabel(t.paymentMethod)},${this.financeService.formatDate(t.date)},${description}\n`;
    });
    
    content += '\n';
    content += `Total de Transações,${transactions.length}\n`;
    
    return content;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
