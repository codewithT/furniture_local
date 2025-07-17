import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private apiUrl = `${environment.apiBaseUrl}/auth`;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // ✅ First, check local session
    if (this.authService.isLoggedIn()) {
      return of(true);
    }

    // 🔁 If not logged in, do server-side session check
    return this.http.get<{ isAuthenticated: boolean; user?: any }>(
      `${this.apiUrl}/is-authenticated`,
      { withCredentials: true }
    ).pipe(
      tap(res => {
        if (res.isAuthenticated && res.user) {
          // Store user in session and service
          sessionStorage.setItem('user_data', JSON.stringify(res.user));
          this.authService.setUser(res.user);
        }
      }),
      map(res => {
        if (!res.isAuthenticated) {
          this.router.navigate(['/auth/login']);
          return false;
        }
        return true;
      }),
      catchError(() => {
        this.router.navigate(['/auth/login']);
        return of(false);
      })
    );
  }
}
