import type { MediaItem, SiteContent } from "../types/content";

const image = (
  id: string,
  title: string,
  category: string,
  usage: MediaItem["usage"],
  order: number,
  aspectRatio: MediaItem["aspectRatio"] = "1:2",
): MediaItem => ({
  id,
  src: "",
  title,
  alt: import.meta.env.DEV ? `Композиционная заглушка: ${title.toLowerCase()}` : `Фирменная иллюстрация: ${title.toLowerCase()}`,
  category,
  aspectRatio,
  focalPoint: { x: 50, y: 50 },
  order,
  visible: true,
  usage,
});

export const defaultContent: SiteContent = {
  version: 1,
  brand: {
    shortName: "MFT39",
    fullName: "Тхэквондо МФТ Калининград",
    motto: "День без тренировки - потерянный день",
    description:
      "Занятия тхэквондо МФТ для детей с четырёх лет, подростков и взрослых в Калининграде.",
    bookingLabel: "Войти в личный кабинет",
  },
  sections: [
    { id: "hero", title: "Тхэквондо МФТ", intro: "Калининград", enabled: true },
    {
      id: "locations",
      title: "Место для тренировки",
      intro:
        "Три зала в Калининграде. Выберите удобный — группу и расписание обсудим с тренером.",
      enabled: true,
    },
    {
      id: "map",
      title: "Найдите свой зал",
      intro: "Адреса и маршруты к трём площадкам.",
      enabled: true,
    },
    {
      id: "coach",
      title: "За каждой победой — работа",
      intro: "Главный тренер",
      enabled: true,
    },
    {
      id: "achievements",
      title: "Наши победы",
      intro:
        "Результаты выездных турниров. Каждая медаль — история тренировок.",
      enabled: true,
    },
    {
      id: "gallery",
      title: "В движении",
      intro:
        import.meta.env.DEV ? "Тренировки, соревнования, команда. Место для будущих фотографий клуба." : "Тренировки, соревнования, команда.",
      enabled: true,
    },
    {
      id: "rutube",
      title: "Тхэквондо в кадре",
      intro: "Видеоматериалы на официальном канале клуба.",
      enabled: true,
    },
    {
      id: "reviews",
      title: "Рядом с командой",
      intro: "Сообщество клуба ВКонтакте.",
      enabled: true,
    },
    {
      id: "contacts",
      title: "Увидимся на тренировке",
      intro:
        "Позвоните или напишите — подберём группу и расскажем об условиях занятий.",
      enabled: true,
    },
  ],
  locations: [
    {
      id: "chelnokova",
      name: "Центр развития тхэквондо МФТ",
      address: "Калининград, улица Генерала Челнокова, 43",
      hours: "Пн–Сб 13:00–21:00; Вс — закрыто",
      schedule:
        "С сентября по май в будни занятия обычно проходят вечером, ориентировочно 18:00–21:00. Конкретные дни и группы уточняются у тренера.",
      yandexUrl: "https://yandex.ru/maps/-/CXCNaB8Z",
      twoGisUrl: "",
    },
    {
      id: "city",
      name: "Центр тхэквондо МФТ — ТЦ «Сити»",
      address: "ТЦ «Сити», Калининград",
      hours: "Пн–Пт 09:00–21:00; Сб–Вс — закрыто",
      schedule:
        "Группу и фактическое расписание тренировок уточните у тренера. Часы площадки не являются расписанием занятий.",
      yandexUrl: "https://yandex.ru/maps/-/CXCNaKYV",
      twoGisUrl: "",
    },
    {
      id: "school10",
      name: "Школа №10",
      address: "Калининград, улица Войнич, 1",
      hours: "Часы работы пока не подтверждены",
      schedule: "Расписание уточняется у тренера",
      yandexUrl: "https://yandex.ru/maps/-/CXCNa0zI",
      twoGisUrl: "",
    },
  ],
  ageGroups: ["Дети с 4 лет", "Подростки", "Взрослые старше 18 лет"],
  discounts: [
    {
      id: "family",
      title: "Многодетным семьям",
      percent: 10,
      details: "Подробности уточняйте у тренера",
    },
    {
      id: "friend",
      title: "Приведи друга",
      percent: 10,
      details: "Подробности уточняйте у тренера",
    },
    {
      id: "siblings",
      title: "Братьям и сёстрам",
      percent: 10,
      details: "Подробности уточняйте у тренера",
    },
  ],
  coaches: [
    {
      id: "mikhovskiy",
      name: "Иван Николаевич Миховский",
      role: "Президент Федерации тхэквондо МФТ Калининградской области",
      qualifications: [
        "Мастер спорта",
        "Чёрный пояс V Дан",
        "Тренер-преподаватель",
      ],
      experience: "Более 14 лет тренерской работы",
      bio: "Иван Николаевич готовит спортсменов к соревнованиям, участвует в развитии федерации и организации турниров. Его воспитанники выступают на всероссийских и международных соревнованиях, получают разряды и проходят аттестации на чёрные пояса.",
      mediaId: "coach-main",
    },
  ],
  medals: {
    gold: 65,
    silver: 49,
    bronze: 68,
    note: "Медали выездных турниров, без учёта региональных турниров Калининградской области.",
  },
  events: [
    {
      id: "moscow-2024",
      year: "2024",
      title: "Москва",
      description: "С московских соревнований команда привезла 31 медаль.",
    },
    {
      id: "tashkent-2025",
      year: "2025",
      title: "Ташкент",
      description:
        "В ноябре спортсмены участвовали в международном турнире в комплексе «Юнусабад» в Узбекистане. Выступали в спаррингах и формальных комплексах.",
    },
    {
      id: "tatarstan-2025",
      year: "2025",
      title: "Татарстан",
      description: "Команда участвовала в Спартакиаде молодёжи России.",
    },
    {
      id: "svetlogorsk-2025",
      year: "2025",
      title: "Светлогорск",
      description:
        "Калининградская команда выиграла командное первенство всероссийского турнира по тхэквондо.",
    },
    {
      id: "russia-2025",
      year: "2025",
      title: "Первенство России",
      description:
        "Калининградская спортсменка одержала победу на первенстве России по тхэквондо.",
    },
    {
      id: "belts-2025",
      year: "2025",
      title: "Аттестация",
      description:
        "Девять спортсменов успешно прошли аттестацию на чёрные пояса.",
    },
    {
      id: "ranks-2024-2025",
      year: "2024–2025",
      title: "Спортивные разряды",
      description:
        "Воспитанники получают юношеские и спортивные разряды и идут к званию кандидата в мастера спорта.",
    },
  ],
  media: [
    image("hero-training", "Тренировка", "Тренировки", "hero", 0),
    image("hero-competition", "Соревнование", "Соревнования", "hero", 1),
    image("hero-team", "Команда", "Команда", "hero", 2, "1:1"),
    image("hero-award", "Награждение", "Награждения", "hero", 3),
    image("hero-detail", "Движение", "Тренировки", "hero", 4),
    image("coach-main", "Портрет тренера", "Тренер", "coach", 0),
    image(
      "gallery-training",
      "На тренировке",
      "Тренировки",
      "gallery",
      0,
      "1:1",
    ),
    image("gallery-sparring", "Спарринг", "Соревнования", "gallery", 1),
    image("gallery-team", "Вместе с командой", "Команда", "gallery", 2, "1:1"),
    image("gallery-belt", "Аттестация", "Аттестации", "gallery", 3),
    image("gallery-award", "После турнира", "Награждения", "gallery", 4, "1:1"),
    image(
      "gallery-movement",
      "Работа над техникой",
      "Тренировки",
      "gallery",
      5,
    ),
  ],
  video: {
    channelName: "Тхэквондо МФТ Калининград",
    channelUrl: "https://rutube.ru/channel/55532225/",
    videoUrl: "",
    description:
      "Выбранный ролик появится здесь после добавления ссылки. Пока можно перейти к официальному каналу.",
    posterMediaId: "",
  },
  reviews: [],
  contacts: {
    phone: "+7 (960) 297-53-77",
    email: "tkdmft39@mail.ru",
    vkUrl: "https://vk.ru/tkdmft39",
    rutubeUrl: "https://rutube.ru/channel/55532225/",
  },
  theme: {
    defaultMode: "dark",
    accent: "#D82930",
    secondaryAccent: "#FF681E",
    gridOpacity: 0.08,
  },
  motion: {
    enabled: true,
    introDuration: 3,
    transitionDuration: 0.45,
    rotateSpeed: 0.018,
    inertia: 0.93,
    tilt: 6,
    radius: 360,
  },
  pages: {
    "/": {
      title: "Тхэквондо МФТ Калининград — MFT39",
      description:
        "Три зала в Калининграде. Тхэквондо МФТ для детей с четырёх лет, подростков и взрослых.",
    },
    "/coach": {
      title: "Главный тренер — MFT39",
      description:
        "Иван Николаевич Миховский — мастер спорта, чёрный пояс V Дан, более 14 лет тренерской работы.",
    },
    "/achievements": {
      title: "Наши победы — MFT39",
      description: "Медали выездных турниров и история соревнований клуба.",
    },
    "/contacts": {
      title: "Залы и контакты — MFT39",
      description:
        "Адреса трёх залов, телефон и электронная почта клуба в Калининграде.",
    },
    "/rutube": {
      title: "Видео клуба — MFT39",
      description: "Официальный канал MFT39 на RuTube.",
    },
    "/vk": {
      title: "Сообщество — MFT39",
      description:
        "Официальное сообщество MFT39 ВКонтакте и подтверждённые отзывы.",
    },
    "/login": {
      title: import.meta.env.DEV ? "Демонстрационный вход — MFT39" : "Вход — MFT39",
      description: "Вход в личный кабинет MFT39 через Яндекс ID.",
    },
    "/account": {
      title: import.meta.env.DEV ? "Демонстрационный кабинет — MFT39" : "Личный кабинет — MFT39",
      description: "Личный кабинет пользователя MFT39.",
    },
    "/account/bookings": { title: "Мои тренировки — MFT39", description: "Тренировки в личном кабинете MFT39." },
    "/account/book": { title: "Записаться на тренировку — MFT39", description: "Подготовка заявки на тренировку. Онлайн-отправка пока недоступна." },
    "/account/profile": { title: "Мои данные — MFT39", description: "Данные аккаунта MFT39." },
    "/booking": {
      title: import.meta.env.DEV ? "Демонстрационная запись — MFT39" : "Запись на тренировку — MFT39",
      description:
        "Для записи свяжитесь с тренером по указанным контактам.",
    },
  },
};

export const siteContent = defaultContent;
