import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
    imports : [RouterOutlet, RouterModule],
  template: `<router-outlet></router-outlet>`, // No navbar here
})
export class AuthLayoutComponent {}
