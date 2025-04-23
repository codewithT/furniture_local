import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowOrderDetailsComponent } from './show-order-details.component';

describe('ShowOrderDetailsComponent', () => {
  let component: ShowOrderDetailsComponent;
  let fixture: ComponentFixture<ShowOrderDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowOrderDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowOrderDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
