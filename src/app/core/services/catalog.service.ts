import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Banner, Category, Product, ProductDetail, ProductFilterFacets, ProductListFilters, Subcategory } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private http: HttpClient) {}

  listCategories(orgId?: number): Observable<Category[]> {
    let params = new HttpParams();
    if (orgId != null) {
      params = params.set('org_id', orgId);
    }
    return this.http
      .get<{ data: { categories: Category[] } }>(`${environment.apiBaseUrl}/ecommerce/categories`, { params })
      .pipe(map((res) => res.data.categories));
  }

  listSubcategories(orgId: number, categoryId?: number): Observable<Subcategory[]> {
    let params = new HttpParams().set('org_id', orgId);
    if (categoryId) {
      params = params.set('category_id', categoryId);
    }
    return this.http
      .get<{ data: { subcategories: Subcategory[] } }>(`${environment.apiBaseUrl}/ecommerce/subcategories`, { params })
      .pipe(map((res) => res.data.subcategories));
  }

  listBanners(orgId: number): Observable<Banner[]> {
    return this.http
      .get<{ data: { banners: Banner[] } }>(`${environment.apiBaseUrl}/ecommerce/banners`, { params: { org_id: orgId } })
      .pipe(map((res) => res.data.banners));
  }

  searchProducts(orgId: number, filters: ProductListFilters = {}): Observable<Product[]> {
    let params = new HttpParams().set('org_id', orgId);
    if (filters.categoryId) params = params.set('category_id', filters.categoryId);
    if (filters.subcategoryId) params = params.set('subcategory_id', filters.subcategoryId);
    if (filters.vendorId) params = params.set('vendor_id', filters.vendorId);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.limit) params = params.set('limit', filters.limit);
    if (filters.lat != null) params = params.set('lat', filters.lat);
    if (filters.lng != null) params = params.set('lng', filters.lng);
    if (filters.brands?.length) params = params.set('brand', filters.brands.join(','));
    if (filters.minPrice != null) params = params.set('min_price', filters.minPrice);
    if (filters.maxPrice != null) params = params.set('max_price', filters.maxPrice);
    if (filters.minDiscount != null) params = params.set('min_discount', filters.minDiscount);
    if (filters.sort && filters.sort !== 'relevance') params = params.set('sort', filters.sort);
    return this.http
      .get<{ data: { products: Product[] } }>(`${environment.apiBaseUrl}/ecommerce/products`, { params })
      .pipe(map((res) => res.data.products));
  }

  // The brand checkbox list + price range for a listing's current category/subcategory/search
  // scope -- NOT its brand/price/discount/sort selections (see ProductFilterFacets' own comment).
  getProductFilters(
    orgId: number,
    scope: { categoryId?: number; subcategoryId?: number; vendorId?: number; q?: string } = {}
  ): Observable<ProductFilterFacets> {
    let params = new HttpParams().set('org_id', orgId);
    if (scope.categoryId) params = params.set('category_id', scope.categoryId);
    if (scope.subcategoryId) params = params.set('subcategory_id', scope.subcategoryId);
    if (scope.vendorId) params = params.set('vendor_id', scope.vendorId);
    if (scope.q) params = params.set('q', scope.q);
    return this.http
      .get<{ data: ProductFilterFacets }>(`${environment.apiBaseUrl}/ecommerce/products/filters`, { params })
      .pipe(map((res) => res.data));
  }

  getProduct(productId: number): Observable<ProductDetail> {
    return this.http
      .get<{ data: { product: ProductDetail } }>(`${environment.apiBaseUrl}/ecommerce/products/${productId}`)
      .pipe(map((res) => res.data.product));
  }

  similarProducts(productId: number): Observable<Product[]> {
    return this.http
      .get<{ data: { products: Product[] } }>(`${environment.apiBaseUrl}/ecommerce/products/${productId}/similar`)
      .pipe(map((res) => res.data.products));
  }
}
