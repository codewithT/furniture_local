import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesMonthComponent } from './sales-month.component';

describe('SalesMonthComponent', () => {
  let component: SalesMonthComponent;
  let fixture: ComponentFixture<SalesMonthComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesMonthComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesMonthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
