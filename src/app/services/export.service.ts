import { Injectable, inject } from '@angular/core';
import { FormattingService } from './formatting.service';
import { Transaction } from '../models/transaction.model';
import { PeriodoResumo } from './financeiro.service';
import { Lancamento } from '../models/interfaces';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  private formattingService = inject(FormattingService);


  async exportToPDF(summary: PeriodoResumo, transactions: Array<Transaction | Lancamento>, period: string): Promise<void> {
    // Implementação básica - em produção, usar jsPDF
    const content = this.generatePDFContent(summary, transactions, period);
    this.downloadFile(content, 'relatorio.pdf', 'application/pdf');
  }

  async exportToExcel(summary: PeriodoResumo, transactions: Array<Transaction | Lancamento>, period: string): Promise<void> {
    // Implementação básica - em produção, usar xlsx
    const content = this.generateExcelContent(summary, transactions, period);
    this.downloadFile(content, 'relatorio.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  private generatePDFContent(summary: PeriodoResumo, transactions: Array<Transaction | Lancamento>, period: string): string {
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');
    
    let content = `═══════════════════════════════════════════════════\n`;
    content += `     RELATÓRIO FINANCEIRO - SOLARIS\n`;
    content += `═══════════════════════════════════════════════════\n\n`;
    content += `Data de Geração: ${date} às ${time}\n`;
    content += `Período: ${this.getPeriodLabel(period)}\n`;
    content += `Data de Referência: ${this.formattingService.formatDate(summary.date)}\n\n`;
    
    content += `═══════════════════════════════════════════════════\n`;
    content += `                    RESUMO\n`;
    content += `═══════════════════════════════════════════════════\n`;
    content += `Total de Entradas: ${this.formattingService.formatCurrency(summary.totalEntradas)}\n`;
    content += `Total de Saídas:   ${this.formattingService.formatCurrency(summary.totalSaidas)}\n`;
    content += `Saldo Final:        ${this.formattingService.formatCurrency(summary.saldo)}\n\n`;
    
    content += `═══════════════════════════════════════════════════\n`;
    content += `                 TRANSAÇÕES\n`;
    content += `═══════════════════════════════════════════════════\n\n`;
    
    if (transactions.length === 0) {
      content += `Nenhuma transação encontrada no período.\n`;
    } else {
      // Agrupar por tipo
      const entradas = transactions.filter(t => this.resolveTipo(t) === 'entrada');
      const saidas = transactions.filter(t => this.resolveTipo(t) === 'saida');
      
      if (entradas.length > 0) {
        content += `ENTRADAS (${entradas.length}):\n`;
        content += `───────────────────────────────────────────────────\n`;
        entradas.forEach((t, index) => {
          content += `${index + 1}. ${this.resolveTitulo(t)}\n`;
          content += `   Valor: ${this.formattingService.formatCurrency(this.resolveValor(t))}\n`;
          content += `   Categoria: ${this.resolveCategoria(t)}\n`;
          content += `   Forma de Pagamento: ${this.getPaymentMethodLabel(this.resolveMetodoPagamento(t))}\n`;
          content += `   Data: ${this.formattingService.formatDate(this.resolveData(t))}\n`;
          const descricao = this.resolveDescricao(t);
          if (descricao) {
            content += `   Observação: ${descricao}\n`;
          }
          content += `\n`;
        });
      }
      
      if (saidas.length > 0) {
        content += `SAÍDAS (${saidas.length}):\n`;
        content += `───────────────────────────────────────────────────\n`;
        saidas.forEach((t, index) => {
          content += `${index + 1}. ${this.resolveTitulo(t)}\n`;
          content += `   Valor: ${this.formattingService.formatCurrency(this.resolveValor(t))}\n`;
          content += `   Categoria: ${this.resolveCategoria(t)}\n`;
          content += `   Forma de Pagamento: ${this.getPaymentMethodLabel(this.resolveMetodoPagamento(t))}\n`;
          content += `   Data: ${this.formattingService.formatDate(this.resolveData(t))}\n`;
          const descricao = this.resolveDescricao(t);
          if (descricao) {
            content += `   Observação: ${descricao}\n`;
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
      'cartao_debito': 'Cartão de Débito',
      'boleto': 'Boleto',
      'transferencia': 'Transferência'
    };
    return labels[method] || method;
  }

  private resolveTipo(transaction: Transaction | Lancamento): 'entrada' | 'saida' {
    if ('type' in transaction) {
      return transaction.type;
    }
    return transaction.tipo === 'ENTRADA' ? 'entrada' : 'saida';
  }

  private resolveTitulo(transaction: Transaction | Lancamento): string {
    if ('title' in transaction) {
      return transaction.title;
    }
    return transaction.descricao || 'Lançamento';
  }

  private resolveValor(transaction: Transaction | Lancamento): number {
    if ('amount' in transaction) {
      return transaction.amount;
    }
    return transaction.valor;
  }

  private resolveCategoria(transaction: Transaction | Lancamento): string {
    if ('category' in transaction) {
      return transaction.category;
    }
    return transaction.categoria || 'Sem categoria';
  }

  private resolveMetodoPagamento(transaction: Transaction | Lancamento): string {
    if ('paymentMethod' in transaction) {
      return transaction.paymentMethod;
    }
    return transaction.metodo_pagamento || 'dinheiro';
  }

  private resolveData(transaction: Transaction | Lancamento): string {
    if ('date' in transaction) {
      return transaction.date;
    }
    const competencia = transaction.data_vencimento;
    if (competencia instanceof Date) {
      return competencia.toISOString();
    }
    if (typeof competencia === 'string') {
      return competencia;
    }
    if (typeof competencia === 'number') {
      return new Date(competencia).toISOString();
    }
    if (competencia && typeof (competencia as { toDate?: () => Date }).toDate === 'function') {
      return (competencia as { toDate: () => Date }).toDate().toISOString();
    }
    return '';
  }

  private resolveDescricao(transaction: Transaction | Lancamento): string {
    if ('type' in transaction) {
      return transaction.description || '';
    }
    return transaction.descricao || '';
  }

  private generateExcelContent(summary: PeriodoResumo, transactions: Array<Transaction | Lancamento>, period: string): string {
    const date = new Date().toLocaleDateString('pt-BR');
    
    let content = 'RELATÓRIO FINANCEIRO - SOLARIS\n';
    content += `Data de Geração,${date}\n`;
    content += `Período,${this.getPeriodLabel(period)}\n`;
    content += `Data de Referência,${this.formattingService.formatDate(summary.date)}\n`;
    content += '\n';
    content += 'RESUMO\n';
    content += `Total de Entradas,${summary.totalEntradas}\n`;
    content += `Total de Saídas,${summary.totalSaidas}\n`;
    content += `Saldo Final,${summary.saldo}\n`;
    content += '\n';
    content += 'TRANSAÇÕES\n';
    content += 'Tipo,Título,Valor,Categoria,Forma de Pagamento,Data,Descrição\n';
    
    transactions.forEach(t => {
      const description = (this.resolveDescricao(t) || '').replace(/,/g, ';').replace(/\n/g, ' ');
      const tipo = this.resolveTipo(t) === 'entrada' ? 'Entrada' : 'Saída';
      content += `${tipo},${this.resolveTitulo(t)},${this.resolveValor(t)},${this.resolveCategoria(t)},${this.getPaymentMethodLabel(this.resolveMetodoPagamento(t))},${this.formattingService.formatDate(this.resolveData(t))},${description}\n`;
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
