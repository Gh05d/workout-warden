// src/Routes.tsx
import React from 'react';
import {ActivityIndicator, StatusBar, useColorScheme, View} from 'react-native';
import {DefaultTheme, NavigationContainer, Theme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import HomeScreen from './screens/Home';
import StatisticsScreen from './screens/Statistics';
import TrainingProgramScreen from './screens/Session';
import Weeks from './screens/Weeks';

import {colors} from './common/theme';
import {
  fetchActivePlanId,
  fetchPlanDays,
  getDBConnection,
} from './common/databaseService';
import type {BaseProps, PlanDay} from './common/types';

const Tab = createBottomTabNavigator();
const SubTab = createMaterialTopTabNavigator();

const renderTabBarIcon =
  (name: string) =>
  ({color, size}: {color: string; size: number}) =>
    <MaterialIcons name={name as any} color={color} size={size} />;

const SessionsTabs: React.FC<BaseProps> = ({route}) => {
  const [days, setDays] = React.useState<PlanDay[] | null>(null);

  React.useEffect(() => {
    (async () => {
      const db = await getDBConnection();
      const planId = await fetchActivePlanId(db);
      if (planId == null) {
        setDays([]);
        return;
      }
      setDays(await fetchPlanDays(db, planId));
    })();
  }, []);

  if (days === null) {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SubTab.Navigator
      backBehavior="history"
      screenOptions={{tabBarScrollEnabled: true, tabBarBounces: true, lazy: true}}>
      {days.map(day => {
        const label = day.weekday_label
          ? `${day.session_template_name}: ${day.weekday_label}`
          : day.session_template_name;
        return (
          <SubTab.Screen
            key={day.id}
            name={label}
            component={TrainingProgramScreen}
            initialParams={{
              weekID: route.params?.weekID,
              day_index: day.day_index,
              title: label,
            }}
          />
        );
      })}
    </SubTab.Navigator>
  );
};

const Routes: React.FC<{puppy: string}> = ({puppy}) => {
  const AppTheme: Theme = {
    ...DefaultTheme,
    colors: {...DefaultTheme.colors, ...colors},
  };
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.primary}
      />
      <Tab.Navigator backBehavior="history" initialRouteName="Home">
        <Tab.Screen name="Home" component={HomeScreen} initialParams={{puppy}}
          options={{tabBarIcon: renderTabBarIcon('home')}} />
        <Tab.Screen name="Weeks" component={Weeks}
          options={{tabBarIcon: renderTabBarIcon('save-as')}} />
        <Tab.Screen name="Sessions" component={SessionsTabs}
          options={{tabBarIcon: renderTabBarIcon('fitness-center')}} />
        <Tab.Screen name="Statistics" component={StatisticsScreen}
          options={{tabBarIcon: renderTabBarIcon('bar-chart')}} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default Routes;
