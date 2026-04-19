import { Component, Input, OnInit } from '@angular/core';

export type FitnessObjectType = 'dumbbell' | 'kettlebell' | 'bottle' | 'sphere';

@Component({
  selector: 'app-fitness-object',
  templateUrl: './fitness-object.component.html',
  styleUrls: ['./fitness-object.component.scss'],
})
export class FitnessObjectComponent implements OnInit {
  private static idCounter = 0;

  @Input() type: FitnessObjectType = 'sphere';
  @Input() size = 150;
  @Input() hue = 320;

  uid = '';

  ngOnInit(): void {
    FitnessObjectComponent.idCounter += 1;
    this.uid = `fo-${FitnessObjectComponent.idCounter}`;
  }

  get bottleHeight(): number {
    return this.size * (220 / 140);
  }
}
