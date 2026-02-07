import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SaleEditorPage } from './sale-editor.page';

describe('SaleEditorPage', () => {
  let component: SaleEditorPage;
  let fixture: ComponentFixture<SaleEditorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SaleEditorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
