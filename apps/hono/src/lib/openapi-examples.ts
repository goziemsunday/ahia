export const authExamples = {
  changePwdValErrs: {
    newPassword: "Too small: expected string to have >=8 characters",
    currentPassword: "Too small: expected string to have >=8 characters",
  },
  emailValErr: {
    email: "Invalid email address",
  },
  uuidValErr: {
    id: "Invalid UUID",
  },
};

export const userExamples = {
  createUserValErrs: {
    name: "Too small: expected string to have >=1 characters",
    email: "Invalid email address",
    role: 'Invalid option: expected one of "user"|"admin"',
  },
  banUserValErrs: {
    userId: "Too small: expected string to have >=1 characters",
    banReason: "Too small: expected string to have >=1 characters",
    banExpiresIn: "Too small: expected number to be >=3600",
  },
  sessionTokenValErrs: {
    sessionToken: "Too small: expected string to have >=1 characters",
  },
  userIdValErrs: {
    userId: "Too small: expected string to have >=1 characters",
  },
  updateUserValErrs: {
    name: "Too small: expected string to have >=1 characters",
    image: "Invalid URL",
  },
  changePasswordValErrs: {
    currentPassword: "Too small: expected string to have >=8 characters",
    newPassword: "Too small: expected string to have >=8 characters",
  },
};

export const adminExamples = {
  getUsersValErrs: {
    searchField: 'Invalid option: expected one of "email"|"name"',
    searchOperator:
      'Invalid option: expected one of "contains"|"starts_with"|"ends_with"',
    limit: "Too small: expected number to be >0",
    offset: "Invalid input: expected number, received NaN",
    sortDirection: 'Invalid option: expected one of "asc"|"desc"',
    filterOperator:
      'Invalid option: expected one of "eq"|"ne"|"lt"|"lte"|"gt"|"gte"|"contains"',
  },
  createUserValErrs: {
    name: "Too small: expected string to have >=1 characters",
    email: "Invalid email address",
    role: 'Invalid option: expected one of "user"|"admin"',
  },
};

export const categoriesExamples = {
  createCategoryValErrs: {
    name: "Too small: expected string to have >=1 characters",
  },
};

export const productsExamples = {
  createProductValErrs: {
    name: "Too small: expected string to have >=1 characters",
    description: "Too small: expected string to have >=1 characters",
    price: "Too small: expected string to have >=1 characters",
    stockQuantity: "Required",
    sizes: "Sizes must be valid JSON",
    colors: "Colors must be valid JSON",
    categoryIds: "At least one category is required",
  },
  getShopValErrs: {
    page: "Too small: expected number to be >0",
    limit: "Too small: expected number to be >0",
    minPrice: "Too small: expected number to be >=0",
    maxPrice: "Too small: expected number to be >0",
    sort: 'Invalid option: expected one of "newest"|"price-asc"|"price-desc"',
    new: 'Invalid option: expected one of "true"|"false"',
  },
  searchProductValErrs: {
    q: "Invalid input: expected string, received undefined",
    limit: "Too small: expected number to be >0",
  },
};

export const cartExamples = {
  addToCartValErrs: {
    productId: "Invalid UUID",
    quantity: "Too small: expected number to be >=1",
  },
  updateCartItemValErrs: {
    quantity: "Too small: expected number to be >=1",
  },
};

export const miscExamples = {
  paginationValErrs: {
    page: "Too small: expected number to be >0",
    limit: "Too small: expected number to be >0",
  },
};
