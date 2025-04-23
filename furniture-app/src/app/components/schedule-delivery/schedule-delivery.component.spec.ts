import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScheduleDeliveryComponent } from './schedule-delivery.component';

describe('ScheduleDeliveryComponent', () => {
  let component: ScheduleDeliveryComponent;
  let fixture: ComponentFixture<ScheduleDeliveryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleDeliveryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScheduleDeliveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
