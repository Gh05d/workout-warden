import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import HomeScreen from './screens/Home';
import StatisticsScreen from './screens/Statistics';
import TrainingProgramScreen from './screens/Session';
import Weeks from './screens/Weeks';

import {colors, training} from './common/variables';

const Tab = createBottomTabNavigator();
const SubTab = createMaterialTopTabNavigator();

const WeeklyTrainingTabs: React.FC<BaseProps> = ({route}) => (
  <SubTab.Navigator
    backBehavior="history"
    screenOptions={{
      tabBarScrollEnabled: true,
      tabBarBounces: true,
      lazy: true,
    }}>
    {training.A.sessions.map((session, day: number) => (
      <SubTab.Screen
        key={session.day}
        name={session.day}
        component={TrainingProgramScreen}
        initialParams={{
          weekID: route.params?.weekID,
          title: session.day,
          day,
        }}
      />
    ))}
  </SubTab.Navigator>
);

const renderTabBarIcon =
  (name: string) =>
  ({color, size}: {color: string; size: number}) =>
    <MaterialIcons name={name} color={color} size={size} />;

const Routes: React.FC<{puppy: string}> = ({puppy}) => {
  const AppTheme: Theme = {
    ...DefaultTheme,
    colors: {...DefaultTheme.colors, ...colors},
  };

  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? colors.primary : colors.primary,
  };

  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <Tab.Navigator backBehavior="history" initialRouteName="Home">
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          initialParams={{puppy}}
          options={{tabBarIcon: renderTabBarIcon('home')}}
        />
        <Tab.Screen
          name="Weeks"
          component={Weeks}
          options={{tabBarIcon: renderTabBarIcon('save-as')}}
        />
        <Tab.Screen
          name="Sessions"
          component={WeeklyTrainingTabs}
          options={{
            tabBarIcon: renderTabBarIcon('fitness-center'),
            tabBarLabel: 'Sessions',
          }}
        />
        <Tab.Screen
          name="Statistics"
          component={StatisticsScreen}
          options={{tabBarIcon: renderTabBarIcon('bar-chart')}}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default Routes;
