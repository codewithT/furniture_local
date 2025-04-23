 
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