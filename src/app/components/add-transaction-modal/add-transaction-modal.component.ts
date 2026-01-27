import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonDatetimeButton,
  IonModal,
  IonDatetime
} from '@ionic/angular/standalone';
import { FinanceService } from '../../services/finance.service';
import { Transaction, CATEGORIAS_SOLARIS } from '../../models/transaction.model';
import { addIcons } from 'ionicons';
import { close, checkmark } from 'ionicons/icons';

@Component({
  selector: 'app-add-transaction-modal',
  templateUrl: './add-transaction-modal.component.html',
  styleUrls: ['./add-transaction-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonDatetimeButton,
    IonModal,
    IonDatetime
  ]
})
export class AddTransactionModalComponent implements OnInit {
  @Input() transaction?: Transaction;

  type: 'entrada' | 'saida' = 'entrada';
  title: string = '';
  amount: number | null = null;
  category: string = '';
  paymentMethod: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' = 'dinheiro';
  date: string = new Date().toISOString();
  description: string = '';
  clientName: string = '';
  clientPhone: string = '';
  clientAddress: string = '';

  categorias = CATEGORIAS_SOLARIS;
  isEditMode: boolean = false;

  constructor(
    private modalController: ModalController,
    private financeService: FinanceService,
    private toastController: ToastController
  ) {
    addIcons({ close, checkmark });
  }

  ngOnInit() {
    if (this.transaction) {
      this.isEditMode = true;
      this.type = this.transaction.type;
      this.title = this.transaction.title;
      this.amount = this.transaction.amount;
      this.category = this.transaction.category;
      this.paymentMethod = this.transaction.paymentMethod;
      this.date = this.transaction.date;
      this.description = this.transaction.description || '';
      this.clientName = this.transaction.clientName || '';
      this.clientPhone = this.transaction.clientPhone || '';
      this.clientAddress = this.transaction.clientAddress || '';
    }
  }

  get availableCategories(): string[] {
    return this.type === 'entrada' 
      ? this.categorias.entradas 
      : this.categorias.saidas;
  }

  get paymentMethods() {
    return [
      { value: 'pix', label: 'PIX' },
      { value: 'dinheiro', label: 'Dinheiro' },
      { value: 'cartao_credito', label: 'Cartão de Crédito' },
      { value: 'cartao_debito', label: 'Cartão de Débito' },
    ];
  }

  async save() {
    // Validações
    if (!this.title || this.title.trim() === '') {
      await this.showToast('Por favor, preencha o título', 'warning');
      return;
    }

    if (!this.amount || this.amount <= 0) {
      await this.showToast('Por favor, informe um valor válido maior que zero', 'warning');
      return;
    }

    if (!this.category || this.category.trim() === '') {
      await this.showToast('Por favor, selecione uma categoria', 'warning');
      return;
    }

    if (!this.date) {
      await this.showToast('Por favor, selecione uma data', 'warning');
      return;
    }

    const transactionData = {
      type: this.type,
      title: this.title.trim(),
      amount: this.amount,
      category: this.category,
      paymentMethod: this.paymentMethod,
      date: this.date,
      description: this.description?.trim() || '',
      clientName: this.clientName?.trim() || '',
      clientPhone: this.clientPhone?.trim() || '',
      clientAddress: this.clientAddress?.trim() || '',
    };

    try {
      if (this.isEditMode && this.transaction) {
        this.financeService.updateTransaction(this.transaction.id, transactionData);
        await this.showToast('Transação atualizada com sucesso!', 'success');
      } else {
        this.financeService.addTransaction(transactionData);
        await this.showToast('Transação adicionada com sucesso!', 'success');
      }

      await this.modalController.dismiss({ saved: true });
    } catch (error) {
      await this.showToast('Erro ao salvar transação', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  async cancel() {
    await this.modalController.dismiss();
  }
}
