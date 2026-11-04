import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {View,Text,Pressable,TextInput,ScrollView,useWindowDimensions} from 'react-native-web';
const ink='#203d38',muted='#58675e',paper='#fbf8f1',line='#cfcabe';
const yearLabel=y=>y<0?Math.abs(y)+' TCN':String(y);
function Button({children,onPress,active}){return <Pressable accessibilityRole="button" onPress={onPress} style={{minHeight:40,paddingHorizontal:12,paddingVertical:9,borderRadius:20,borderWidth:1,borderColor:line,backgroundColor:active?ink:paper,justifyContent:'center'}}><Text style={{fontSize:13,fontWeight:'600',color:active?paper:ink}}>{children}</Text></Pressable>;}
function Entry({entry,detail,onRead}){return <Pressable accessibilityRole="link" onPress={()=>onRead(entry.id)} style={{paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#e4ddd1'}}><Text style={{fontFamily:'Cambria, Georgia, serif',fontSize:18,lineHeight:24,color:ink}}>{entry.title}</Text>{detail&&<Text style={{fontSize:12,lineHeight:18,color:muted,marginTop:4}}>{detail}</Text>}</Pressable>;}
function Place({card,width,onRead}){
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>setExpanded(false),[card.year,card.lane]);
 const period=card.active[0];
 return <View style={{width,padding:14,borderWidth:1,borderColor:line,borderRadius:10,backgroundColor:'#fffcf6',alignSelf:'flex-start'}}>
 <Text accessibilityRole="heading" style={{fontSize:23,fontFamily:'Cambria, Georgia, serif',color:ink,borderBottomWidth:2,borderBottomColor:'#98442d',paddingBottom:10}}>{card.name}</Text>
 <Text style={styles.label}>BỐI CẢNH</Text>
 {period?<Entry entry={period} detail={yearLabel(period.source.s)+' – '+yearLabel(period.source.e)} onRead={onRead}/>:<Text style={styles.empty}>Chưa có bối cảnh trong dữ liệu.</Text>}
 {expanded&&card.active.map((e,i)=><View key={e.id}>{i>0&&<Entry entry={e} onRead={onRead}/>}<Text style={styles.body}>{e.source.d}</Text></View>)}
 <Text style={styles.label}>MỐC Ở NĂM {yearLabel(card.year)}</Text>
 {!card.exact.length&&<Text style={styles.empty}>Chưa ghi nhận mốc ở năm này.</Text>}
 {(expanded?card.exact:card.exact.slice(0,2)).map(e=><Entry key={e.id} entry={e} detail={e.source.date||yearLabel(e.year)} onRead={onRead}/>)}
 {!expanded&&card.exact.length>2&&<Text style={styles.empty}>Còn {card.exact.length-2} mốc</Text>}
 <Text style={styles.label}>NHÂN VẬT CÙNG THỜI</Text>
 {(expanded?card.people:card.people.slice(0,1)).map(e=><Entry key={e.id} entry={e} detail={e.source.timeBasis?'Chưa xác định tuổi':(e.source.cb?'Khoảng ':'')+(card.year-e.year-(e.year<0&&card.year>0?1:0))+' tuổi'} onRead={onRead}/>)}
 {!card.people.length&&<Text style={styles.empty}>Chưa có hồ sơ nhân vật.</Text>}
 {expanded&&card.near.length>0&&<><Text style={styles.label}>MỐC GẦN ĐÓ</Text>{card.near.map(e=><Entry key={e.id} entry={e} detail={yearLabel(e.year)+' · '+(Math.abs(e.year-card.year)-(e.year<0&&card.year>0||e.year>0&&card.year<0?1:0))+' năm '+(e.year<card.year?'trước':'sau')} onRead={onRead}/>)}</>}
 <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={{paddingTop:15,paddingBottom:3}}><Text style={{color:'#98442d',fontSize:13,fontWeight:'600'}}>{expanded?'Thu gọn ↑':'Xem thêm trong năm này ↓'}</Text></Pressable>
 </View>;
}
function Comparison(p){
 const {width}=useWindowDimensions();
 const [edit,setEdit]=useState(false),[pick,setPick]=useState(false),[draft,setDraft]=useState(String(p.year)),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(p.year));setError('');setEdit(false);},[p.year]);
 useEffect(()=>{p.onReady();},[]);
 const apply=()=>{const y=Number(draft);if(!draft.trim()||!Number.isInteger(y)||y===0||y< -3500||y>2026){setError('Nhập năm từ 3500 TCN đến 2026, không có năm 0.');return;}p.onYear(y);setEdit(false);};
 const cardWidth=width<600?Math.max(230,Math.min(280,width-70)):p.cards.length===3?192:292;
 return <View style={{gap:12,paddingVertical:10}}>
 <View style={{flexDirection:'row',justifyContent:'space-between',gap:8,flexWrap:'wrap',alignItems:'center'}}><Text style={{fontSize:16,fontWeight:'600',color:ink}}>Cùng năm {yearLabel(p.year)}</Text><View style={{flexDirection:'row',gap:6}}><Button onPress={()=>setEdit(!edit)} active={edit}>Đổi năm</Button><Button onPress={()=>setPick(!pick)} active={pick}>Chọn nơi</Button></View></View>
 {edit&&<View style={{gap:8}}><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><TextInput accessibilityLabel="Năm đối chiếu" value={draft} onChangeText={setDraft} onSubmitEditing={apply} style={{borderWidth:1,borderColor:line,borderRadius:6,padding:9,width:115,fontSize:16,color:ink}}/><Button onPress={apply}>Áp dụng</Button>{p.year!==p.currentYear&&<Button onPress={()=>p.onYear(p.currentYear)}>Về năm của bài</Button>}</View><Text style={styles.empty}>{error||'Số âm là năm trước Công nguyên.'}</Text></View>}
 <Text style={{fontSize:13,lineHeight:19,color:muted}}>{p.cards.map(c=>c.name).join(' · ')}{width<600?' · Vuốt ngang để xem từng nơi':''}</Text>
 {pick&&<View style={{gap:8}}><Text style={styles.empty}>Chọn hai hoặc ba nơi. Chọn nơi khác để thay cột thứ ba.</Text><View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}>{p.regions.map(r=><Button key={r.id} active={p.lanes.includes(r.id)} onPress={()=>{const active=p.lanes.includes(r.id);if(active&&p.lanes.length>2)p.onLanes(p.lanes.filter(id=>id!==r.id));else if(!active)p.onLanes(p.lanes.length===3?[...p.lanes.slice(0,2),r.id]:[...p.lanes,r.id]);}}>{p.lanes.includes(r.id)?'✓ ':''}{r.name}</Button>)}</View></View>}
 <ScrollView horizontal contentContainerStyle={{gap:10,paddingBottom:12}}>{p.cards.map(c=><Place key={c.lane} card={c} width={cardWidth} onRead={p.onRead}/>)}</ScrollView>
 <Text style={{fontSize:12,lineHeight:18,color:muted}}>Mốc trước hoặc sau nằm trong phần mở rộng và có ghi khoảng cách thời gian.</Text>
 </View>;
}
const styles={label:{fontSize:10,fontWeight:'700',color:muted,marginTop:16,letterSpacing:.4},empty:{fontSize:13,lineHeight:19,color:muted,marginTop:6},body:{fontFamily:'Cambria, Georgia, serif',fontSize:17,lineHeight:25,color:ink,marginVertical:9}};
let root,node;
window.mountNativeComparison=(target,props)=>{if(node!==target){if(root)root.unmount();node=target;root=createRoot(target);}root.render(<Comparison {...props}/>);};
window.unmountNativeComparison=()=>{if(root)root.unmount();root=null;node=null;};
window.dispatchEvent(new Event('native-comparison-ready'));
