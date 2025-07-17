import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import {User, Role,ComponentRole } from '../models/admin.model';
@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiBaseUrl}/admin`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  getComponentRoles(): Observable<ComponentRole[]> {
    return this.http.get<ComponentRole[]>(`${this.apiUrl}/component-roles`);
  }

  createUser(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, userData);
  }

  updateUserRoles(userId: number, roleIds: number[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/roles`, { roleIds });
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  createRole(roleName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/roles`, { name: roleName });
  }

  assignComponentRole(componentName: string, roleName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/component-roles`, { componentName, roleName });
  }

  removeComponentRole(componentName: string, roleName: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/component-roles`, {
      body: { componentName, roleName }
    });
  }
}
