type ComputePaginationProps = {
  currentPage: number;
  totalPages: number;
  paginationItemsToDisplay: number;
};

type ComputePaginationReturn = {
  pages: number[];
  showLeftEllipsis: boolean;
  showRightEllipsis: boolean;
};

/**
 * Compute the visible page numbers for a pagination component. This
 * function calculates which page numbers to show and whether to display
 * left/right ellipsis indicators.
 *
 * @returns An object containing the visible page numbers and ellipsis flags.
 */
export const computePagination = ({
  currentPage,
  totalPages,
  paginationItemsToDisplay,
}: ComputePaginationProps): ComputePaginationReturn => {
  if (totalPages <= paginationItemsToDisplay) {
    return {
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
      showLeftEllipsis: false,
      showRightEllipsis: false,
    };
  }

  const halfDisplay = Math.floor(paginationItemsToDisplay / 2);

  let startPage = Math.max(1, currentPage - halfDisplay);
  let endPage = Math.min(totalPages, currentPage + halfDisplay);

  if (endPage - startPage + 1 < paginationItemsToDisplay) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + paginationItemsToDisplay - 1);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, endPage - paginationItemsToDisplay + 1);
    }
  }

  const showLeftEllipsis = startPage > 1;
  const showRightEllipsis = endPage < totalPages;

  if (showLeftEllipsis && showRightEllipsis) {
    if (paginationItemsToDisplay > 4) {
      startPage = Math.max(
        2,
        currentPage - Math.floor((paginationItemsToDisplay - 2) / 2),
      );
      endPage = Math.min(
        totalPages - 1,
        currentPage + Math.floor((paginationItemsToDisplay - 2) / 2),
      );
    }
  } else if (showLeftEllipsis) {
    if (paginationItemsToDisplay > 2) {
      startPage = Math.max(2, totalPages - paginationItemsToDisplay + 2);
      endPage = totalPages - 1;
    }
  } else if (showRightEllipsis) {
    if (paginationItemsToDisplay > 2) {
      startPage = 2;
      endPage = Math.min(totalPages - 1, paginationItemsToDisplay - 1);
    }
  }

  return {
    pages: Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i,
    ),
    showLeftEllipsis,
    showRightEllipsis,
  };
};
