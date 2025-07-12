import { HttpStatus } from '@nestjs/common';

export const ErrorDictionary = {
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'Utilisateur non trouvé',
    status: HttpStatus.NOT_FOUND,
  },
  TEMPLATE_NOT_FOUND: {
    code: 'TEMPLATE_NOT_FOUND',
    message: 'Template non trouvé',
    status: HttpStatus.NOT_FOUND,
  },
  TEMPLATE_CREATE_FAILED: {
    code: 'TEMPLATE_CREATE_FAILED',
    message: 'Failed to create a template',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_LINES_FETCH_FAILED: {
    code: 'TEMPLATE_LINES_FETCH_FAILED',
    message: 'Failed to retrieve template lines',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  TEMPLATE_TRANSACTIONS_CREATE_FAILED: {
    code: 'TEMPLATE_TRANSACTIONS_CREATE_FAILED',
    message: 'Failed to create transactions from template',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
};
