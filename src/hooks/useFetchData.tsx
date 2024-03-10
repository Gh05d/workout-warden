import React from 'react';
import { useTheme } from '@react-navigation/native';
import { AxiosRequestConfig } from 'axios';
import { deepEqual } from '../../common/functions';

const useFetchData = <T,>(url: string, config?: AxiosRequestConfig) => {
  const [stateData, setData] = React.useState<T | null>(null);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadMore, setLoadMore] = React.useState(true);

  const [error, setError] = React.useState<null | Error>(null);
  const [refreshError, setRefreshError] = React.useState<null | Error>(null);
  const [refetch, setRefreshing] = React.useState(false);

  const { apiCall, caches } = useTheme() as unknown as AppTheme;
  const { mixedCache } = caches;

  React.useEffect(() => {
    let didCancel = false;

    (async function fetchData() {
      try {
        const CACHE_KEY = `data-${url.replace(/\//gi, '-')}-${JSON.stringify(
          config
        )}`;
        var data = await mixedCache.peek(CACHE_KEY);

        if (data && !refetch) {
          // This is to make sure we always have the newest data
          apiCall(url, config)
            .then((res) => {
              // Don't update the UI if the data has not changed
              if (!deepEqual(data, res.data)) {
                mixedCache.set(CACHE_KEY, res.data);
              }
            })
            .catch((err) => console.info('Ist wohl schiefgegangen... 🤕', err));
        } else {
          const res = await apiCall(url, config);
          // eslint-disable-next-line prefer-destructuring
          data = res.data;
          if (data?.length) mixedCache.set(CACHE_KEY, data);
        }

        if (!data && !didCancel) throw Error('No data received');

        if (!didCancel) setData(data);
      } catch (err) {
        if (refetch) {
          console.error(err);
          setRefreshError(err as Error);
          setTimeout(() => setRefreshError(null), 700);
        } else setError(err as Error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    })();

    return () => {
      didCancel = true;
    };
  }, [refetch, url]);

  function fetchMore() {
    setLoadMore(true);
    const nextPage = page + 1;
    // Update the API call as per your pagination logic
    apiCall(`${url}?page=${nextPage}`, config)
      .then((res) => {
        //@ts-ignore
        setData((prevData) => [...prevData, ...res.data]);
        setPage(nextPage);
      })
      .catch((err) => {
        console.error('Error fetching more data:', err);
      })
      .finally(() => {
        setLoadMore(false);
      });
  }

  return {
    loading,
    error,
    refreshError,
    refetch,
    loadMore,
    fetchMore,
    setRefreshing,
    data: stateData,
    setData,
  };
};

export default useFetchData;
