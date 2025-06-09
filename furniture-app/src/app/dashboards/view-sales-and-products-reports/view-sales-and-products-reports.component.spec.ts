import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesAndProductsReportsComponent } from './view-sales-and-products-reports.component';

describe('SalesAndProductsReportsComponent', () => {
  let component: SalesAndProductsReportsComponent;
  let fixture: ComponentFixture<SalesAndProductsReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesAndProductsReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesAndProductsReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
