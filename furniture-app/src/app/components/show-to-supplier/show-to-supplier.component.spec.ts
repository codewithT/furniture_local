import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowToSupplierComponent } from './show-to-supplier.component';

describe('ShowToSupplierComponent', () => {
  let component: ShowToSupplierComponent;
  let fixture: ComponentFixture<ShowToSupplierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowToSupplierComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowToSupplierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
