 
// models/product.model.ts
export interface Product {
    ProductID: number;
    ProductCode: string;
    ProductName: string;
    SupplierCode: string;
    SupplierID: number;
    SupplierItemNumber: string;
    SupplierPrice: number;
    MultiplicationFactor: number;
    FinalPrice: number;
    Picture: string;
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