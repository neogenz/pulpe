import type { ClsStore } from 'nestjs-cls';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

export interface AppClsStore extends ClsStore {
  user?: AuthenticatedUser;
  supabase?: AuthenticatedSupabaseClient;
}
