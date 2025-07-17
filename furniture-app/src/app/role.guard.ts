import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const expectedRoles: string[] = route.data['roles'] || [];
    const userRoles: string[] = this.authService.getAllRoles() || [];

    const hasAccess = userRoles.some(role => expectedRoles.includes(role));
    console.log('User roles:', userRoles);
    if (!hasAccess) {
      this.router.navigate(['/u/unauthorized']);
      return false;
    }

    return true;
  }
}
