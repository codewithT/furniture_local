// admin-panel.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { AdminService } from '../../services/adminService.service';
interface User {
  id: number;
  email: string;
  isActive: boolean;
  roles: string;
}

interface Role {
  id: number;
  name: string;
}

interface ComponentRole {
  component_name: string;
  role_name: string;
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule
  ],
   templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css']
})
export class AdminPanelComponent implements OnInit {
  users: User[] = [];
  roles: Role[] = [];
  // componentRoles: ComponentRole[] = [];

  userColumns = ['email', 'roles', 'status', 'actions'];
  // componentRoleColumns = ['component', 'role', 'actions'];

  newRoleName = '';
  newComponentRole = {
    componentName: '',
    roleName: ''
  };

  showCreateUserDialog = false;
  showEditRolesDialog = false;
  selectedUser: User | null = null;

  createUserForm: FormGroup;
  editRolesForm: FormGroup;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.createUserForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      roleIds: [[]]
    });

    this.editRolesForm = this.fb.group({
      roleIds: [[]]
    });
  }

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
    // this.loadComponentRoles();
  }

  loadUsers() {
    this.adminService.getUsers().subscribe({
      next: (data) => this.users = data,
      error: () => this.showError('Failed to load users')
    });
  }

  loadRoles() {
    this.adminService.getRoles().subscribe({
      next: (data) => this.roles = data,
      error: () => this.showError('Failed to load roles')
    });
  }

  // loadComponentRoles() {
  //   this.adminService.getComponentRoles().subscribe({
  //     next: (data) => this.componentRoles = data,
  //     error: () => this.showError('Failed to load component roles')
  //   });
  // }

  getRolesArray(rolesString: string): string[] {
    return rolesString ? rolesString.split(',') : [];
  }

  openCreateUserDialog() {
    this.showCreateUserDialog = true;
    this.createUserForm.reset();
  }

  closeCreateUserDialog() {
    this.showCreateUserDialog = false;
  }

  createUser() {
    if (this.createUserForm.valid) {
      const formData = this.createUserForm.value;
      this.adminService.createUser(formData).subscribe({
        next: () => {
          this.showSuccess('User created successfully');
          this.closeCreateUserDialog();
          this.loadUsers();
        },
        error: () => this.showError('Failed to create user')
      });
    }
  }

 editUserRoles(user: User) {
  console.log('Opening edit dialog for user:', user); // DEBUG
  this.selectedUser = user;

  const userRoleNames = this.getRolesArray(user.roles); // roles is comma-separated string
  const roleIds = this.roles
    .filter(role => userRoleNames.includes(role.name))
    .map(role => role.id);

  this.editRolesForm.patchValue({ roleIds }); // update form control
  this.showEditRolesDialog = true; // ✅ open dialog
}


  closeEditRolesDialog() {
    this.showEditRolesDialog = false;
    this.selectedUser = null;
  }

 updateUserRoles() {
  if (this.selectedUser) {
    const roleIds = this.editRolesForm.value.roleIds;
    console.log('Updating roles for user', this.selectedUser.id, roleIds); // ✅ log here
    this.adminService.updateUserRoles(this.selectedUser.id, roleIds).subscribe({
      next: () => {
        console.log('Roles updated on server'); // ✅ confirm API returned
        this.showSuccess('User roles updated successfully');
        this.closeEditRolesDialog();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to update user roles', err);
        this.showError('Failed to update user roles');
      }
    });
  }
}


  deleteUser(userId: number) {
    if (confirm('Are you sure you want to delete this user?')) {
      this.adminService.deleteUser(userId).subscribe({
        next: () => {
          this.showSuccess('User deleted successfully');
          this.loadUsers();
        },
        error: () => this.showError('Failed to delete user')
      });
    }
  }

  createRole() {
    if (this.newRoleName.trim()) {
      this.adminService.createRole(this.newRoleName.trim()).subscribe({
        next: () => {
          this.showSuccess('Role created successfully');
          this.newRoleName = '';
          this.loadRoles();
        },
        error: () => this.showError('Failed to create role')
      });
    }
  }

  assignComponentRole() {
    const { componentName, roleName } = this.newComponentRole;
    if (componentName.trim() && roleName) {
      this.adminService.assignComponentRole(componentName.trim(), roleName).subscribe({
        next: () => {
          this.showSuccess('Role assigned to component successfully');
          this.newComponentRole = { componentName: '', roleName: '' };
          // this.loadComponentRoles();
        },
        error: () => this.showError('Failed to assign role to component')
      });
    }
  }

  removeComponentRole(item: ComponentRole) {
    if (confirm('Are you sure you want to remove this role assignment?')) {
      this.adminService.removeComponentRole(item.component_name, item.role_name).subscribe({
        next: () => {
          this.showSuccess('Role removed from component successfully');
          // this.loadComponentRoles();
        },
        error: () => this.showError('Failed to remove role from component')
      });
    }
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['error-snackbar']
    });
  }
}