import { Component, OnInit, inject, signal, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonButtons,
  IonSelect,
  IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';
import { Payment } from '../../models/service-order.model'; // Import the Payment interface

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonButtons,
    IonSelect,
    IonSelectOption,
    CurrencyPipe
  ],
  templateUrl: './payment-dialog.component.html',
  styleUrls: ['./payment-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentDialogComponent implements OnInit {
  @Input() pendingAmount!: number;

  private modalCtrl = inject(ModalController);
  private fb = inject(FormBuilder);
  
  paymentForm!: FormGroup;
  isCardPayment = signal(false);

  constructor() {}

  ngOnInit() {
    this.paymentForm = this.fb.group({
      method: ['CASH', Validators.required],
      grossValue: [this.pendingAmount, [Validators.required, Validators.min(0.01)]],
      installments: [{ value: 1, disabled: true }, Validators.min(1)],
      taxRate: [{ value: 0, disabled: true }, Validators.min(0)]
    });

    this.paymentForm.get('method')?.valueChanges.subscribe(method => {
      this.isCardPayment.set(method === 'CREDIT_CARD' || method === 'DEBIT_CARD');
      this.toggleCardPaymentValidators();
    });
  }

  toggleCardPaymentValidators() {
    const installmentsControl = this.paymentForm.get('installments');
    const taxRateControl = this.paymentForm.get('taxRate');

    if (this.isCardPayment()) {
      installmentsControl?.enable();
      taxRateControl?.enable();
      installmentsControl?.setValidators([Validators.required, Validators.min(1)]);
      taxRateControl?.setValidators([Validators.required, Validators.min(0)]);
    } else {
      installmentsControl?.disable();
      taxRateControl?.disable();
      installmentsControl?.clearValidators();
      taxRateControl?.clearValidators();
      installmentsControl?.patchValue(1); // Reset to default
      taxRateControl?.patchValue(0); // Reset to default
    }
    installmentsControl?.updateValueAndValidity();
    taxRateControl?.updateValueAndValidity();
  }

  confirm(): void {
    if (this.paymentForm.valid) {
      const formValue = this.paymentForm.getRawValue(); // Use getRawValue to get disabled control values
      const paymentData: Partial<Payment> = {
        method: formValue.method,
        grossValue: formValue.grossValue,
        installments: formValue.installments,
        taxRate: formValue.taxRate,
      };
      this.modalCtrl.dismiss(paymentData, 'confirm');
    }
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
