import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FinanceService } from './finance.service';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private financeService = inject(FinanceService);


  generatePdf(data: any[], title: string, headers: { title: string, key: string }[], body: any[]) {
    const doc = new jsPDF();
    
    const logo = '/assets/icon/logotipo-piloto.png'; 
    doc.addImage(logo, 'PNG', 14, 10, 40, 10);
    doc.text(title, 14, 30);

    const tableBody = data.map(item => {
      return headers.map(header => {
        if (header.key === 'date') {
          return new Date(item[header.key]).toLocaleDateString('pt-BR');
        }
        if (header.key === 'amount') {
          return this.financeService.formatCurrency(item[header.key]);
        }
        return item[header.key];
      });
    });

    (doc as any).autoTable({
      head: [headers.map(h => h.title)],
      body: tableBody,
      startY: 40
    });

    doc.save(`${title}.pdf`);
  }

  generateReceiptPdf(transaction: Transaction) {
    const doc = new jsPDF();
    const logo = '/assets/icon/logotipo-piloto.png';

    // Cabeçalho
    doc.addImage(logo, 'PNG', 14, 10, 50, 12);
    doc.setFontSize(10);
    doc.text('Solaris Detalhamento Automotivo', 14, 30);
    doc.text('Endereço: Rua Exemplo, 123', 14, 35);
    doc.text('Telefone: (00) 12345-6789', 14, 40);

    // Título do Recibo
    doc.setFontSize(16);
    doc.text('Recibo de Prestação de Serviço', 105, 55, { align: 'center' });

    // Informações do Cliente
    doc.setFontSize(12);
    doc.text(`Cliente: ${transaction.clientName}`, 14, 70);
    if (transaction.clientPhone) {
      doc.text(`Telefone: ${transaction.clientPhone}`, 14, 77);
    }
    if (transaction.clientAddress) {
      doc.text(`Endereço: ${transaction.clientAddress}`, 14, 84);
    }

    // Detalhes do Serviço
    doc.setFontSize(12);
    doc.text('Descrição do Serviço:', 14, 100);
    doc.setFontSize(10);
    doc.text(transaction.title, 14, 107);
    
    // Data e Valor
    doc.setFontSize(12);
    doc.text(`Data: ${this.financeService.formatDate(transaction.date)}`, 14, 120);
    doc.setFontSize(14);
    doc.text(`Valor Total: ${this.financeService.formatCurrency(transaction.amount)}`, 14, 130);

    // Assinatura
    doc.line(60, 160, 150, 160);
    doc.setFontSize(10);
    doc.text('Assinatura do Cliente', 105, 165, { align: 'center' });

    doc.save(`Recibo-${transaction.clientName}-${transaction.date}.pdf`);
  }
}