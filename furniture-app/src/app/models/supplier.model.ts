export interface Supplier {
  SupplierID: number;
  SupplierCode: string;
  SupplierName: string;
  SupplierAddress: string;
  EmailAddress?: string;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
    has_more_pages: boolean;
  };
}