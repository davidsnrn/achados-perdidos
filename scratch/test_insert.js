
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vfcnptykhuljtoykpbmv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_jjl3YMTXv7Ly-LwahfI3Yw_5GZD4fpv'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function testInsert() {
  const payload = {
    campus_id: '949c29e6-e586-432d-9b9e-ef5a5ae73a85',
    date: '2026-05-08',
    time: '12:40',
    student_matricula: 'TEST12345',
    student_name: 'TEST STUDENT',
    period: '2026.1',
    class_name: 'ADM4V',
    notification_type_ids: ['a8c3f8af-e4d3-4cde-9aaf-0436d966c0bf'],
    selected_subtypes: ['Tênis'],
    justification: 'Teste de inserção',
    teacher_referral: false,
    teacher_name: '',
    operator_id: '1'
  }

  console.log('Tentando inserir payload:', payload)
  const { data, error } = await supabase.from('student_notifications').insert(payload).select()

  if (error) {
    console.error('Erro Supabase:', error)
  } else {
    console.log('Sucesso:', data)
  }
}

testInsert()
