import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewSalesReportsComponent } from './view-sales-reports.component';

describe('ViewSalesReportsComponent', () => {
  let component: ViewSalesReportsComponent;
  let fixture: ComponentFixture<ViewSalesReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewSalesReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewSalesReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
