import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginMock, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const enableMockLogin = useMemo(
    () => (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ENABLE_MOCK_LOGIN === 'true',
    []
  );

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      return;
    }
    let isMounted = true;
    const completeSSOLogin = async () => {
      setIsLoading(true);
      setError('');
      try {
        await loginWithToken(token);
        if (isMounted) {
          window.history.replaceState({}, document.title, '/login');
          navigate('/dashboard', { replace: true });
        }
      } catch {
        if (isMounted) {
          setError('SSO 登录回调处理失败，请重试');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    void completeSSOLogin();
    return () => {
      isMounted = false;
    };
  }, [loginWithToken, navigate]);

  const handleSSOLogin = () => {
    window.location.href = '/api/v1/auth/login/sso';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setError('请输入工号');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await loginMock(employeeId);
      navigate('/dashboard');
    } catch {
      setError('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <ShieldCheckIcon className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          企业外出交流信息登记系统
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          通过SSO单点登录进行身份认证
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleSSOLogin}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {isLoading ? '登录中...' : '企业 SSO 登录'}
            </button>
            {enableMockLogin && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700">
                    员工工号（Mock）
                  </label>
                  <div className="mt-1">
                    <input
                      id="employee_id"
                      name="employee_id"
                      type="text"
                      required
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                      placeholder="仅开发环境使用"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  Mock 登录
                </button>
              </form>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {enableMockLogin && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Mock 入口仅用于开发演示
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
