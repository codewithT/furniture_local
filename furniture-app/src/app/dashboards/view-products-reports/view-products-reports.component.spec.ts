import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewProductsReportsComponent } from './view-products-reports.component';

describe('ViewProductsReportsComponent', () => {
  let component: ViewProductsReportsComponent;
  let fixture: ComponentFixture<ViewProductsReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewProductsReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewProductsReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
