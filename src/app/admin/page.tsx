
import { DashboardClient } from '@/components/admin/dashboard-client';
import { getUserFromSession } from '@/lib/user';
import { getDashboardData } from './dashboard/page';

export const dynamic = 'force-dynamic';

export default async function AdminRootPage() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    
    const data = await getDashboardData(user.id);

    if (!data || !data.overallData) {
        return <div>Loading dashboard...</div>;
    }
    
    return <DashboardClient dashboardData={data} />;
}
