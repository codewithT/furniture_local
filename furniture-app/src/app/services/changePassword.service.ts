import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import {User, Role,ComponentRole } from '../models/admin.model';
import { AuthService } from './auth.service';
@Injectable({
  providedIn: 'root'
})
export class ChangePasswordService {
  private apiUrl = `${environment.apiBaseUrl}/u`;

  constructor(private http: HttpClient,
    private authService: AuthService

  ) {}
private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, { currentPassword, newPassword }, this.httpOptions);
  }
}
