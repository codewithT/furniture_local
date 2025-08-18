import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdatedInvoiceComponent } from './updated-invoice.component';

describe('UpdatedInvoiceComponent', () => {
  let component: UpdatedInvoiceComponent;
  let fixture: ComponentFixture<UpdatedInvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdatedInvoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdatedInvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
