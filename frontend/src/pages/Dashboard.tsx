import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  PlusCircleIcon, 
  UserGroupIcon 
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          欢迎回来，{user?.name}
        </h2>
        <p className="text-gray-600">
          部门：{user?.department} | 角色：{user?.role === 'admin' ? '系统管理员' : '普通用户'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/records/new" className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer flex items-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4 group-hover:bg-blue-100">
            <PlusCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">新建申请</h3>
            <p className="text-sm text-gray-500 mt-1">填写并提交新的外出交流信息</p>
          </div>
        </Link>

        <Link to="/records" className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer flex items-center">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mr-4 group-hover:bg-green-100">
            <DocumentTextIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">记录管理</h3>
            <p className="text-sm text-gray-500 mt-1">查看和管理已提交的交流记录</p>
          </div>
        </Link>

        {user?.role === 'admin' && (
          <Link to="/admin/logs" className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer flex items-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mr-4 group-hover:bg-purple-100">
              <UserGroupIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">管理员面板</h3>
              <p className="text-sm text-gray-500 mt-1">查看审计日志和全量数据</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}