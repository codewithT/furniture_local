import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import {User, Role,ComponentRole } from '../models/admin.model';
@Injectable({
  providedIn: 'root'
})
export class ForgotPasswordService {
  private apiUrl = `${environment.apiBaseUrl}/auth`;

  constructor(private http: HttpClient) {}

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    console.log('Resetting password with token:', token, newPassword);
    if (!token || !newPassword) {
        throw new Error('Token and new password are required');
    }
    return this.http.post(`${this.apiUrl}/reset-password`, { token, newPassword });
  }
}
