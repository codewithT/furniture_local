export interface User {
  id: number;
  email: string;
  isActive: boolean;
  roles: string;
}

export interface Role {
  id: number;
  name: string;
}

export interface ComponentRole {
  component_name: string;
  role_name: string;
}