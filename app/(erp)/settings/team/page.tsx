'use client';
import BusinessMembers from '@/components/BusinessMembers';
import {MAIN_API_BASE_URL} from '@/services/api';
import {getAuthToken} from '@/utils/auth-cookie';
export default function TeamPage(){return <BusinessMembers apiBase={MAIN_API_BASE_URL} token={getAuthToken()}/>;}
