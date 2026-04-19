import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ruby-wordmark',
  templateUrl: './ruby-wordmark.component.html',
  styleUrls: ['./ruby-wordmark.component.scss'],
})
export class RubyWordmarkComponent {
  @Input() size = 34;
  @Input() color = '#6b2d87';

  get dotSize(): number {
    return this.size * 0.18;
  }
}
