import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-sale-editor',
  templateUrl: './sale-editor.page.html',
  styleUrls: ['./sale-editor.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class SaleEditorPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
