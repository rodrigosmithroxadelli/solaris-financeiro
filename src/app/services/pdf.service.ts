import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FormattingService } from './formatting.service';
import { Lancamento } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private formattingService = inject(FormattingService);


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
          return this.formattingService.formatCurrency(item[header.key]);
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

  generateReceiptPdf(lancamento: Lancamento) {
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
    doc.text(`Cliente: ${lancamento.cliente_nome}`, 14, 70);
    if (lancamento.cliente_telefone) {
      doc.text(`Telefone: ${lancamento.cliente_telefone}`, 14, 77);
    }
    if (lancamento.cliente_endereco) {
      doc.text(`Endereço: ${lancamento.cliente_endereco}`, 14, 84);
    }

    // Detalhes do Serviço
    doc.setFontSize(12);
    doc.text('Descrição do Serviço:', 14, 100);
    doc.setFontSize(10);
    doc.text(lancamento.descricao ?? 'Serviço Prestado', 14, 107);
    
    // Data e Valor
    doc.setFontSize(12);
    doc.text(`Data: ${this.formattingService.formatDate(lancamento.data_pagamento ?? lancamento.data_vencimento)}`, 14, 120);
    doc.setFontSize(14);
    doc.text(`Valor Total: ${this.formattingService.formatCurrency(lancamento.valor)}`, 14, 130);

    // Assinatura
    doc.line(60, 160, 150, 160);
    doc.setFontSize(10);
    doc.text('Assinatura do Cliente', 105, 165, { align: 'center' });

    doc.save(`Recibo-${lancamento.cliente_nome}-${new Date().toISOString().split('T')[0]}.pdf`);
  }
}